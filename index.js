const execa = require("execa")
const path = require("path")
const a = require("awaiting")
const {Database, Model} = require("mongorito")

const hx711Path = path.join(__dirname, "..", "hx711py")
const tare_cmd = path.join(hx711Path, "tare")
const measure_cmd = path.join(hx711Path, "measure")

const socket = require("socket.io-client")("https://domopets.herokuapp.com/")
const db = new Database("localhost/weight")
class Weight extends Model {}

async function tare() {
  const {stdout} = await execa(tare_cmd)
  return parseInt(stdout)
}

async function measure(tare) {
  const {stdout, stderr} = await execa(measure_cmd, [tare])
  return parseInt(stdout)
}

function getMonday() {
  const d = new Date()
  var day = d.getDay(),
    diff = d.getDate() - day + (day == 0 ? -6 : 1)
  return new Date(d.setDate(diff))
}

async function getHistogram() {
  const ten = (await Weight.sort({date: -1}).limit(10).find())
    .map(w => w.get("value"))
    .reverse()
  const unique = ten.reduce((a, b) => a + b) / ten.length
  const collection = await Weight.getCollection()
  collection
    .aggregate([
      {$match: {date: {$gte: getMonday()}}},
      {$project: {dayOfWeek: {$dayOfWeek: "$date"}}},
      {$group: {_id: "$dayOfWeek", count: {$sum: 1}}},
    ])
    .toArray((err, doc) => {
      const days = {}
      const week = []
      doc.forEach(d => (days[d._id - 2] = d.count))
      for (let i = 0; i < 7; i++) {
        week[i] = days[i] || 0
      }
      socket.emit("dispatch", {
        action: "histogram",
        payload: {
          unique,
          ten,
          week,
        },
      })
    })
}
async function start() {
  await db.connect()
  db.register(Weight)
  socket.on("histogram", getHistogram)
}

let tareVal
let tareTriggered = false
let catOnLitter = false
let lastVal = 0
let weights = []

start().then(() => tare()).then(async val => {
  tareVal = val
  const measureLoop = async () => {
    if (tareTriggered) {
      console.log("reset tare")
      tareVal = await tare()
      tareTriggered = false
    }
    const measureValue = await measure(tareVal)
    if (lastVal - measureValue > 5 && lastVal - measureValue < 50) {
      if (weights.length > 5) {
        const total = weights.reduce((a, b) => a + b)
        const weight = new Weight({
          value: total / weights.length,
          date: new Date(),
        })
        await weight.save()
        console.log("save value")
        getHistogram()
        weights = []
        lastVal = measureValue
      } else {
        weights.push(lastVal - measureValue)
      }
    } else {
      lastVal = measureValue
    }
    socket.emit("dispatch", {
      action: "measure",
      payload: measureValue,
    })
    console.log(measureValue)
    setTimeout(measureLoop, 200)
  }
  measureLoop()
})

const foodServoPath = path.join(__dirname, "..", "food-servo")
const dispenseFoodCmd = path.join(foodServoPath, "dispense-food")

let dispensingFood = false
async function dispenseFood() {
  dispensingFood = true
  await execa(dispenseFoodCmd)
  dispensingFood = false
}

socket.on("connect", () => {
  socket.emit("type", "FOOD")
})
socket.on("tare", () => (tareTriggered = true))
socket.on("dispenseFood", () => dispenseFood())
