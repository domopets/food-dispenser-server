const io = require("socket.io")()
const mdns = require("mdns")
const execa = require("execa")
const path = require("path")
const a = require("awaiting")

const internalIp = require("os").networkInterfaces().wlan0[0].address

console.log(internalIp)

const port = 8889
const ad = mdns.createAdvertisement(mdns.tcp("http"), port, {
  name: "DOMOPETS_FoodDispenser",
  txtRecord: {
    url: `${internalIp}:${port}`,
  },
})

const hx711Path = path.join(__dirname, "..", "hx711py")
const tare_cmd = path.join(hx711Path, "tare")
const measure_cmd = path.join(hx711Path, "measure")

async function tare() {
  const {stdout} = await execa(tare_cmd)
  return parseInt(stdout)
}

async function measure(tare) {
  const {stdout, stderr} = await execa(measure_cmd, [tare])
  return parseInt(stdout)
}

let tareVal
let tareTriggered = false
tare().then(async val => {
  tareVal = val
  const measureLoop = async () => {
    if (tareTriggered) {
      console.log("reset tare")
      tareVal = await tare()
      tareTriggered = false
    }
    const measureValue = await measure(tareVal)
    io.emit("measure", measureValue)
    console.log(measureValue)
    setTimeout(measureLoop, 200)
  }
  measureLoop()
})

const foodServoPath = path.join(__dirname, "..", "food-servo")
const openFoodCmd = path.join(foodServoPath, "open-food")
const closeFoodCmd = path.join(foodServoPath, "close-food")

let dispensingFood = false
async function dispenseFood() {
  dispensingFood = true
  await execa(openFoodCmd)
  await a.delay(200)
  await execa(closeFoodCmd)
  dispensingFood = false
}

io.on("connection", socket => {
  socket.on("tare", () => (tareTriggered = true))
  socket.on("tareTriggered", () => io.emit("tareTriggered", tareTriggered))
  socket.on("dispenseFood", () => dispenseFood())
  socket.on("dispensingFood", () => io.emit("dispensingFood", dispensingFood))
})

io.listen(port)
