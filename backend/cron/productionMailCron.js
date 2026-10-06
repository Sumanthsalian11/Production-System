const cron = require("node-cron");
const ProductionReal = require("../models/ProductionReal");

const Activity = require("../models/ActivityMaster"); // adjust to your model file names
const Machine = require("../models/MachineMaster");   // adjust to your model file names
const User = require("../models/User"); // to find login users' emails
const sendMail = require("../utils/mailSender");
const { TO, CC } = require("../utils/productionMailConfig");



// ---- machine hours helpers (same logic as the Perso consolidated report) ----
// minutes between "HH:MM" from/to times; a To time earlier than From crosses midnight
const getDurationMins = (from, to) => {
  if (!from || !to) return 0;
  const [fh, fm] = String(from).split(":").map(Number);
  const [th, tm] = String(to).split(":").map(Number);
  let mins = (th * 60 + tm) - (fh * 60 + fm);
  if (mins <= 0) mins += 24 * 60;
  return mins;
};

// minutes -> h:mm:ss
const formatHMS = (m) => {
  const total = Math.round((m || 0) * 60);
  const h = Math.floor(total / 3600);
  const min = Math.floor((total % 3600) / 60);
  const sec = total % 60;
  return `${h}:${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
};

// activities that must NOT appear in this mail (compared ignoring case/extra spaces)
const EXCLUDED_ACTIVITIES = ["perso printing"];
const isExcluded = (name) =>
  EXCLUDED_ACTIVITIES.includes(String(name || "").trim().replace(/\s+/g, " ").toLowerCase());

// Runs daily at 6:00 AM, reports on the PREVIOUS calendar day (Day + Night shift complete)
cron.schedule("0 10 * * *", async () => {
  try {
    // Window: 10:00 AM yesterday to 10:00 AM today
    const toTime = new Date();
    toTime.setHours(10, 0, 0, 0); 

    const fromTime = new Date(toTime);
    fromTime.setDate(fromTime.getDate() - 1);
// cron.schedule("31 13 * * *", async () => {
//   try {
//     // Window: 12:00 PM today to 12:50 PM today (TEST VALUES - change before deploying)
//     const fromTime = new Date();
//     fromTime.setHours(1, 28, 0, 0);

//     const toTime = new Date();
//     toTime.setHours(1, 32, 0, 0);

    // only entries whose PRODUCTION DATE is yesterday (not when they were saved)
    const ymd = `${fromTime.getFullYear()}-${String(fromTime.getMonth() + 1).padStart(2, "0")}-${String(fromTime.getDate()).padStart(2, "0")}`;

    const entries = await ProductionReal.find({
      productionDate: {
        $gte: new Date(`${ymd}T00:00:00.000Z`),
        $lte: new Date(`${ymd}T23:59:59.999Z`),
      },
    })
      .populate("machiness.activityId")
      .populate("machiness.machineId")
      .lean();

    const dateStr = fromTime.toLocaleDateString("en-GB").replace(/\//g, ".");

    // ===== NO ENTRY MADE ON THAT DAY -> still send a mail saying so =====
    if (!entries.length) {
      const fmtDT = (d) =>
        d
          .toLocaleString("en-GB", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            hour12: true,
          })
          .replace(/\//g, ".")
          .replace(",", "")
          .toUpperCase();

      const fromStr = fmtDT(fromTime); // e.g. 02.10.2026 10:00 AM
      const toStr = fmtDT(toTime);     // e.g. 03.10.2026 10:00 AM

      const noEntryHtml = `
      <div style="font-family:Arial,sans-serif;font-size:14px;">
        <p><b>No production entry was made for production date ${dateStr}.</b></p>
        <p>No machine production, idle, breakdown or maintenance records were entered in this period.</p>
      </div>`;

      const toList = Array.isArray(TO) ? TO : TO ? [TO] : [];
      const ccNoEntry = (Array.isArray(CC) ? CC : CC ? [CC] : []).filter((c) => !toList.includes(c));

      if (!toList.length) {
        console.log("⚠️ No entries and the fixed TO list is empty/undefined - check utils/productionMailConfig.js exports TO. Mail not sent.");
        return;
      }

      await sendMail({
        to: toList,
        cc: ccNoEntry,
        subject: `SM/ W&D FLOOR PRODUCTION REPORT ${dateStr}. - NO ENTRY MADE`,
        html: noEntryHtml,
      });

      console.log(`⚠️ No production entries for ${dateStr} - "no entry" mail sent.`);
      return;
    }

    // ================= GROUP BY ACTIVITY (DEI Machine) + MACHINE =================
    const grouped = {};

    // seed EVERY activity + machine so all machines appear (zeros if no entry)
    const [allActivities, allMachines] = await Promise.all([
      Activity.find({}).lean(),
      Machine.find({}).lean(),
    ]);

    allActivities.forEach((act) => {
      if (isExcluded(act.activityName)) return;
      const actMachineIds = (act.machines || []).map(String);
      allMachines
        .filter((m) => actMachineIds.includes(String(m._id)))
        .forEach((m) => {
          const key = `${act.activityName}|||${m.machineName}`;
          if (!grouped[key]) {
            grouped[key] = {
              activityName: act.activityName,
              machineName: m.machineName,
              machineId: m._id,
              hasEntry: false,
              day: 0,
              night: 0,
              prodMins: 0,
              idleMins: 0,
              breakdownMins: 0,
              maintMins: 0,
            };
          }
        });
    });

    entries.forEach((entry) => {
      const qty = Number(entry.productionImpression) || 0;


      // machine hours for this entry, by machine status
      const durMins = getDurationMins(entry.productionFromTime, entry.productionToTime);
      const statusKey = String(entry.machineStatus || "").toLowerCase();

      (entry.machiness || []).forEach((pair) => {
        const activityName = pair.activityId?.activityName || "Unknown";
        if (isExcluded(activityName)) return;
        const machineName = pair.machineId?.machineName || "Unknown";
        const machineId = pair.machineId?._id || pair.machineId;
        const key = `${activityName}|||${machineName}`;

        if (!grouped[key]) {
          grouped[key] = {
            activityName,
            machineName,
            machineId,
            day: 0,
            night: 0,

            prodMins: 0,
            idleMins: 0,
            breakdownMins: 0,
            maintMins: 0,
          };
        }

        grouped[key].hasEntry = true;

        if (entry.shift === "Day") {
          grouped[key].day += qty;
        } else if (entry.shift === "Night") {
          grouped[key].night += qty;
        }

        // machine hours (production / idle / breakdown / maintenance)
        if (statusKey === "production" || statusKey === "working") {
          grouped[key].prodMins += durMins;
        } else if (statusKey === "idle" || statusKey === "idle time") {
          grouped[key].idleMins += durMins;
        } else if (statusKey.includes("break")) {
          grouped[key].breakdownMins += durMins;
        } else if (statusKey.includes("maint")) {
          grouped[key].maintMins += durMins;
        }
      });
    });



    // ================= GROUP ROWS BY ACTIVITY FOR ROWSPAN =================
    const byActivity = {};
    Object.values(grouped).forEach((r) => {
      if (!byActivity[r.activityName]) byActivity[r.activityName] = [];
      byActivity[r.activityName].push(r);
    });

    let rows = "";

    Object.keys(byActivity).forEach((activityName) => {
      const machineRows = byActivity[activityName];

      machineRows.forEach((r, idx) => {

        const grandTotal = r.day + r.night;

        const totalMins = r.prodMins + r.idleMins + r.breakdownMins + r.maintMins;
const timingStyle = totalMins < 24 * 60 ? "background:#ff4d4d;color:#ffffff;" : "";

        rows += `<tr>`;
        if (idx === 0) {
          rows += `<td rowspan="${machineRows.length}" style="text-align:center;vertical-align:middle;">${activityName}</td>`;
        }
        // no entry made for this machine -> one merged message cell instead of zeros
        if (!r.hasEntry) {
          rows += `
          <td>${r.machineName}</td>
          <td colspan="8" style="text-align:center;font-weight:bold;color:#b45309;background:#fff7e6;">No entry made</td>
        </tr>`;
          return;
        }

        rows += `
          <td>${r.machineName}</td>
          <td style="text-align:center;">${r.day}</td>

          <td style="text-align:center;">${r.night}</td>

                 <td style="text-align:center;">${grandTotal}</td>
          <td style="text-align:center;">${formatHMS(r.prodMins)}</td>
          <td style="text-align:center;">${formatHMS(r.idleMins)}</td>
          <td style="text-align:center;">${formatHMS(r.breakdownMins)}</td>
          <td style="text-align:center;">${formatHMS(r.maintMins)}</td>
          <td style="text-align:center;font-weight:bold;${timingStyle}">${formatHMS(totalMins)}</td>
        </tr>`;
      });
    });

    const html = `
    <div style="font-family:Arial,sans-serif">
      <table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse;width:100%;font-size:13px;">
        <thead style="background:#a9cce3;text-align:center;">
          <tr>
            <th rowspan="2">DEI Machine</th>
            <th rowspan="2">Machine</th>
            <th colspan="3">Date ${dateStr}</th>
            <th colspan="5">Machine Hours</th>
          </tr>
          <tr>
            <th>Day Shift</th>
            <th>Night Shift</th>
            <th>Grand Total</th>
            <th>Production Time</th>
            <th>Idle Time</th>
            <th>Breakdown Time</th>
            <th>Maintenance Time</th>
            <th>Total Timings</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;

    // ================= LOGIN-BASED RECIPIENTS (by user ID) =================
    // TO = users who logged in and entered production in this window.
    // Match by user ID so two users with the same name but different emails
    // are never mixed up. Name matching is only a fallback for old records.
    const userIds = new Set();
    const legacyNames = new Set(); // records saved before enteredById existed

    entries.forEach((e) => {
      if (e.enteredById) {
        userIds.add(String(e.enteredById._id || e.enteredById));
      } else if (e.enteredBy && e.enteredBy.trim()) {
        legacyNames.add(e.enteredBy.trim());
      }
    });

    const emailSet = new Set();

    // 1) Exact match by ID
    if (userIds.size) {
      const users = await User.find({ _id: { $in: [...userIds] } })
        .select("name email")
        .lean();

      users.forEach((u) => u.email && emailSet.add(u.email));

      const foundIds = new Set(users.map((u) => String(u._id)));
      const missingIds = [...userIds].filter((id) => !foundIds.has(id));
      if (missingIds.length) {
        console.log(`⚠️ No user record found for IDs: ${missingIds.join(", ")}`);
      }
    }

    // 2) Fallback for old records: match by name, but skip ambiguous names
    if (legacyNames.size) {
      const users = await User.find({ name: { $in: [...legacyNames] } })
        .select("name email")
        .lean();

      const byName = {};
      users.forEach((u) => {
        const key = (u.name || "").trim();
        (byName[key] = byName[key] || []).push(u);
      });

      legacyNames.forEach((name) => {
        const list = byName[name] || [];

        if (!list.length) {
          console.log(`⚠️ No user record found for: ${name}`);
          return;
        }

        if (list.length > 1) {
          console.log(
            `⚠️ Duplicate name "${name}" (${list.map((u) => u.email).join(", ")}) - skipped, cannot tell who entered it.`
          );
          return;
        }

        if (list[0].email) emailSet.add(list[0].email);
      });
    }

    const loginEmails = [...emailSet];

    // fall back to the fixed TO list if no login email could be found
    const recipients = loginEmails.length ? loginEmails : (Array.isArray(TO) ? TO : TO ? [TO] : []);

    if (!recipients.length) {
      console.log("⚠️ No login-based emails and the fixed TO list is empty/undefined - mail not sent.");
      return;
    }

    if (!loginEmails.length) {
      console.log("⚠️ No login-based emails found - using fixed TO list.");
    }

    // don't repeat an address in both TO and CC
    const ccList = (CC || []).filter((c) => !recipients.includes(c));

    await sendMail({
      to: recipients,
      cc: ccList,
      subject: `SM/ W&D FLOOR PRODUCTION REPORT ${dateStr}.`,
      html,
    });

    console.log(
      `✅ Production report mail sent for ${dateStr} | to: ${recipients.join(", ")}`
    );
  } catch (err) {
    console.error("❌ Production Mail Cron Error:", err);
  }
});