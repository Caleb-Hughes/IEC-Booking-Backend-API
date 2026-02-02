const express = require('express');
const router = express.Router();
const prisma = require("../db/prisma");
const {verifyToken, isAdmin} = require('../middleware/authMiddleware');

const salonTz = "America/New_York";

//helper functions
function timeStrngToMnts(t) {
    const [h, m] = String(t).split(":").map(Number);
    return h * 60 + m;
}

function toHHMMInTz(date, tz) {
    const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: tz,
        hour: "2-digit",
        minute: "2-digit",
        hour12: false
    }).formatToParts(date);

    const hh = parts.find((p) => p.type === "hour")?.value ?? "00";
    const mm = parts.find((p) => p.type === "minute")?.value ?? "00";
    return `${hh}:${mm}`
}
//get offset mints for gicen utc date in tz
function tzOffsetMinutes(utcDate, tz) {
    const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: tz,
        timeZoneName: "shortOffset",
        hour: "2-digit",
    }).formatToParts(utcDate);

    const tzName = parts.find((p) => p.type === "timeZoneName")?.value || "GMT+0";
    const m = tzName.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
    if (!m) return 0;

    const sign = m[1] === "-" ? -1 : 1;
    const hours = Number(m[2] || 0);
    const mins = Number(m[3] || 0);
    return sign * (hours * 60 + mins);
}

//convert local date in salon tz into utc range
function zonedDayRangeUTC(dateStr, tz) {
    const [y, mo, d] = String(dateStr).split("-").map(Number);
     if (!y || !mo || !d) return null;

     // Use noon UTC to safely determine offset for that local date (handles DST)
      const utcNoon = new Date(Date.UTC(y, mo - 1, d, 12, 0, 0));
     const offsetMin = tzOffsetMinutes(utcNoon, tz);

     // Local midnight in TZ corresponds to UTC midnight
     const startUTC = new Date(Date.UTC(y, mo - 1, d, 0, 0, 0) - offsetMin * 60000);
     const endUTC = new Date(Date.UTC(y, mo - 1, d + 1, 0, 0, 0) - offsetMin * 60000);

     return { startUTC, endUTC };
}
function generateTimeSlots(start, end, intervalMin) {
  const startMin = timeStrngToMnts(start);
  const endMin = timeStrngToMnts(end);

  const slots = [];
  for (let t = startMin; t + intervalMin <= endMin; t += intervalMin) {
    const hh = String(Math.floor(t / 60)).padStart(2, "0");
    const mm = String(t % 60).padStart(2, "0");
    slots.push(`${hh}:${mm}`);
  }
  return slots;
}

//Get router to fetch all stylists
router.get('/', async (req, res) => {
    try {
        const {serviceId} = req.query;
        const stylists = await prisma.user.findMany({
            where: {
                role: "stylist",
                ...(serviceId
                    ? {
                        services: {
                            some: {id: String(serviceId)},
                        },
                    }
                : {}),
            },
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                offDays: true,
                workingStart: true,
                workingEnd: true,
                services: {select: {id: true, name: true, duration: true, price: true}},
            },
            orderBy: {name: "asc"},
        });

        res.status(200).json(stylists);
    } catch (error) { //error handler for unexpected errors
        console.error(error);
        res.status(500).json({message: 'Error fetching stylists'});
    }
});

//Post router to assign services to stylist
router.post('/:id/services', verifyToken, isAdmin, async (req, res) => {
    try {
        const stylistId = req.params.id;
        //pulling service ID array from request
        const serviceIds = Array.isArray(req.body.serviceIds) ? req.body.serviceIds.map(String) : [];
        //initializing stylist variable and finding stylists by ID
        const stylist = await prisma.user.findUnique({
            where: {id: stylistId},
            select: {id: true, role: true}
        });
       //if no stylist found or if role not equal to stylist return 404 error
        if (!stylist || stylist.role !== 'stylist') {
            return res.status(404).send('Stylist Not Found');
        }
        //Validate service exists
        const found = await prisma.service.findMany({
            where: {id: {in: serviceIds}},
            select: {id: true}
        });
        
        //if one or more services in the request body don't match return error
        if (found.length !== serviceIds.length) {
            return res.status(400).json({message: 'One or more service ID do not exist'});
        }
        const update = await prisma.user.update({
            where: {id: stylistId},
            data: {
                services: {
                    set: serviceIds.map((id) => ({id}))
                },
            },
            select: {
                id: true,
                name: true,
                role: true,
                services: {select: {id: true, name: true}}
            }
        });        
    
        res.status(200).json({message: 'Service assigned successfully', stylist: update});

    } catch (error) { //error handler for unexpected errors
        console.error(error);
        res.status(500).json({message: 'Server error assigning services to stylist'});
    }
});
//get router to fetch stylist that offer specific services
router.get('/by-service/:serviceId', async (req, res) => {
    try {
        const {serviceId} = req.params;
        //searching for all users with stylist role and services array include the requested service
        const stylists = await prisma.user.findMany({
            where: {
                role: "stylist",
                services: {some: {id: String(serviceId)}},
            },
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                offDays: true,
                workingStart: true,
                workingEnd: true
            },
            orderBy: {name: "asc"}
        });

        res.status(200).json(stylists);

    } catch (error) { //error handler for unexpected errors
        console.error(error);
        res.status(500).json({message: 'Error fetching stylists for service'});
    }
});

router.put('/:id/schedule', verifyToken, isAdmin, async (req, res) => {
    try {
        const stylistId = req.params.id;
        // pulling working hours and off days from request body
        const {offDays, workingStart, workingEnd, workingHours} = req.body;

        // finding stylist by ID
        const stylist = await prisma.user.findUnique({
            where: {id: stylistId},
            select: {id: true, role: true}
        });

        // if stylist not found return error
        if (!stylist || stylist.role !== 'stylist') {
            return res.status(404).json({ message: 'Stylist not found' });
        }

        const nxtWorkingStart = workingStart ?? workingHours?.start;
        const nxtWorkingEnd = workingEnd ?? workingHours?.end;

        const updated = await prisma.user.update({
            where: {id: stylistId},
            data: {
                ...(Array.isArray(offDays) ? {offDays} : {}),
                ...(nxtWorkingStart ? {workingStart: String(nxtWorkingStart)} : {}),
                ...(nxtWorkingEnd ? {workingEnd: String(nxtWorkingEnd)} : {})
            },
            select: {
                id: true,
                name: true,
                role: true,
                offDays: true,
                workingStart: true,
                workingEnd: true
            }
        });

        res.status(200).json({ message: 'Stylist schedule updated successfully', stylist: updated });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error updating stylist schedule' });
    }
});

//get route to return available time slots
router.get('/:id/available-slots', async (req, res) => {
    try {
        const stylistId = req.params.id;
        //find stylist by ID
        const stylist =  await prisma.user.findUnique({
            where: {id: stylistId},
            select: {
                id: true,
                role: true,
                offDays: true,
                workingStart: true,
                workingEnd: true
            },
        });
        //if stylist not found return error
        if (!stylist || stylist.role !== 'stylist') {
            return res.status(404).json({message: 'Stylist not found'});
        }
        //unpacking date query parameter from request
        const {date, serviceId} = req.query;
        
        if (!date) {
            return res.status(400).json({ message: "Date not found" });
        }
       
        const dayRange = zonedDayRangeUTC(String(date), salonTz);
        if(!dayRange) {
            return res.status(400).json({message: "Invalid date format"})
        }

        //Day name in salon timezone 
        const localDayName = new Date (dayRange.startUTC).toLocaleDateString("en-US", {
            weekday: "long",
            timeZone: salonTz
        });

        const dateString = String(date); //YYYY-MM-DD Format

        if ((stylist.offDays || []).includes(localDayName) || (stylist.offDays || []).includes(dateString)) {
            return res.status(200).json({ availableSlots: [], message: "Stylist is off on this day" });
        }

        //Slot interval. Using service duration
        let intervalMin = 60;
        if (serviceId) {
            const svc = await prisma.service.findUnique({
                where: {id: String(serviceId)},
                select: {duration: true}
            });
            if (svc?.duration) intervalMin = svc.duration;
        }

        const allSlots = generateTimeSlots (
            stylist.workingStart ?? "09:00",
            stylist.workingEnd ?? "17:00",
            intervalMin
        );

        //pulling appointments within local day
        const appts = await prisma.appointment.findMany({
            where: {
                stylistId,
                status: {in: ["accepted", "pending"]},
                date: {gte: dayRange.startUTC, lt: dayRange.endUTC}
            }, 
            select: {date: true, endDate: true},
        });

        const availableSlots = allSlots.filter((slotTime) => {
        // slotTime is "HH:MM"
        const slotStartMin = timeStrngToMnts(slotTime);
        const slotEndMin = slotStartMin + intervalMin;

        const isConflict = appts.some((appt) => {
        // Convert appointment start/end into minutes in salon timezone
        const apptStartMin = timeStrngToMnts(toHHMMInTz(appt.date, salonTz));
        const apptEndMin = timeStrngToMnts(toHHMMInTz(appt.endDate, salonTz));

        // overlap test
        return slotStartMin < apptEndMin && slotEndMin > apptStartMin;
    });

  return !isConflict;
});

        res.status(200).json({availableSlots});
    } catch (error) {
        console.error('Error generating available slots: ', error.message);
        res.status(500).json({message: 'Error generating available slots', error: error.message});
    }
});

module.exports = router;