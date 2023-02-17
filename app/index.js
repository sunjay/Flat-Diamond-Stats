import clock from "clock";
import document from "document";
import { display } from "display";
import { preferences } from "user-settings";
import { me as appbit } from "appbit";
import { HeartRateSensor } from "heart-rate";
import { BodyPresenceSensor } from "body-presence";
import { battery } from "power";
import { today, goals } from "user-activity";
import * as util from "../common/utils";

const BAR_WIDTH = 120;
const DOC_WIDTH = 336;

function clamp(value, min, max) {
  return Math.min(Math.max(min, value), max);
}

function leftBar(value, max) {
  const width = clamp((value / max) * BAR_WIDTH, 0, BAR_WIDTH);
  
  return {x1: 0, x2: width};
}

function rightBar(value, max) {
  const width = Math.round(clamp((value / max) * BAR_WIDTH, 0, BAR_WIDTH));
  
  return {x1: DOC_WIDTH-BAR_WIDTH, x2: DOC_WIDTH-BAR_WIDTH+width};
}

////// CLOCK //////

const WEEKDAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

const clockLabel = document.getElementById("clock");
const clockAMPM = document.getElementById("clock-am-pm");
const dateLabel = document.getElementById("date");

// Update the clock every minute
clock.granularity = "minutes";

// Update the <text> element every tick with the current time
clock.addEventListener("tick", (evt) => {
  const today = evt.date;
  let hours = today.getHours();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  if (preferences.clockDisplay === "12h") {
    // 12h format
    hours = hours % 12 || 12;
    clockAMPM.text = ampm;
  } else {
    // 24h format
    hours = util.zeroPad(hours);
    clockAMPM.text = '';
  }
  const mins = util.zeroPad(today.getMinutes());
  clockLabel.text = `${hours}:${mins}`;
  
  const weekday = WEEKDAYS[today.getDay()];
  const month = MONTHS[today.getMonth()];
  const day = today.getDate();
  dateLabel.text = `${weekday} ${month} ${day}`;
});

////// ACTIVE MINUTES //////

const activeMinsLabel = document.getElementById("active-mins");
activeMinsLabel.text = '-- MINS';

function updateActiveMins() {
  const mins = today.adjusted.activeZoneMinutes.total;
  activeMinsLabel.text = `${mins} MINS`;
}

////// STEPS //////

const stepsLabel = document.getElementById("steps");
const stepsBar = document.getElementById("steps-bar");

stepsLabel.text = '--';

function getSteps() {
  let val = (today.adjusted.steps || 0);
  return {
    raw: val,
    pretty: val > 999 ? Math.floor(val/1000) + "," + ("00"+(val%1000)).slice(-3) : val
  }
}

function updateSteps() {
  const steps = getSteps();
  stepsLabel.text = steps.pretty;
  const bar = leftBar(steps.raw, goals.steps);
  stepsBar.x1 = bar.x1;
  stepsBar.x2 = bar.x2;
}

////// CALORIES //////

const caloriesLabel = document.getElementById("calories");
const caloriesBar = document.getElementById("calories-bar");
caloriesLabel.text = '--';

function getCalories() {
  let val = (today.adjusted.calories || 0);
  return {
    raw: val,
    pretty: val > 999 ? Math.floor(val/1000) + "," + ("00"+(val%1000)).slice(-3) : val
  }
}

function updateCalories() {
  const calories = getCalories();
  caloriesLabel.text = calories.pretty;
  const bar = rightBar(calories.raw, goals.calories);
  caloriesBar.x1 = bar.x1;
  caloriesBar.x2 = bar.x2;
}

if (appbit.permissions.granted("access_activity")) {   
  clock.granularity = "seconds";
  clock.addEventListener("tick", (evt) => {
    updateActiveMins();
    updateSteps();
    updateCalories();
  });
}

////// BATTERY //////

const batteryLabel = document.getElementById("battery");
const batteryBar = document.getElementById("battery-bar");
batteryLabel.text = '--%';

function updateBattery() {
  const level = Math.floor(battery.chargeLevel);
  batteryLabel.text = `${level}%`;
  const bar = leftBar(level, 100);
  batteryBar.x1 = bar.x1;
  batteryBar.x2 = bar.x2;
}

battery.onchange = updateBattery;
updateBattery();

////// HEART RATE //////

const heartRateLabel = document.getElementById("heart-rate");
const heartRateBar = document.getElementById("heart-rate-bar");
heartRateLabel.text = '--';

if (HeartRateSensor && appbit.permissions.granted("access_heart_rate")) {
  const hrm = new HeartRateSensor({ frequency: 1 });
  hrm.addEventListener("reading", () => {
    heartRateLabel.text = `${hrm.heartRate}`;
    const bar = rightBar(hrm.heartRate, 220);
    heartRateBar.x1 = bar.x1;
    heartRateBar.x2 = bar.x2;
  });
  hrm.start();
  
  display.addEventListener("change", () => {
    // Automatically stop the sensor when the screen is off to conserve battery
    display.on ? hrm.start() : hrm.stop();
  });
  
  if (BodyPresenceSensor) {
    const body = new BodyPresenceSensor();
    body.addEventListener("reading", () => {
      if (!body.present) {
        hrm.stop();
        heartRateLabel.text = '--';
      } else {
        hrm.start();
      }
    });
    body.start();
  }
}
