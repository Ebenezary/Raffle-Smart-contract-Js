const { deployments, ethers, getNamedAccounts, network } = require("hardhat")
const { developmentChains, networkConfig } = require("../../helper-hardhat-config")
const { assert, expect } = require("chai")
const BigNumber = require("bignumber.js")
const { time, helpers } = require("@nomicfoundation/hardhat-network-helpers")

!developmentChains.includes(network.name)
    ? describe.skip
    : describe("Raffle Unit Tests", function () {
          let raffle,
              vrfCoordinatorV2Mock,
              vrfCoordinatorV2MockContractAddress,
              raffleContractAddress,
              chainId,
              raffleEntranceFee,
              deployer,
              interval
          beforeEach(async function () {
              deployer = (await getNamedAccounts()).deployer
              await deployments.fixture(["all"])
              raffleContractAddress = (await deployments.get("Raffle")).address
              vrfCoordinatorV2MockContractAddress = (await deployments.get("VRFCoordinatorV2Mock"))
                  .address
              raffle = await ethers.getContractAt("Raffle", raffleContractAddress)
              vrfCoordinatorV2Mock = await ethers.getContractAt(
                  "VRFCoordinatorV2Mock",
                  vrfCoordinatorV2MockContractAddress,
              )
              raffleEntranceFee = await raffle.getEntranceFee()
              interval = await raffle.getInterval()
          })
          describe("constructor", function () {
              it("It initializes the raffle correctly", async function () {
                  //Ideally we make our test have just 1 assert per it
                  const raffleState = await raffle.getRaffleState()
                  chainId = network.config.chainId
                  assert.equal(raffleState, 0)
                  assert.equal(interval, networkConfig[chainId]["interval"])
              })
          })
          describe("Enter Raffle", function () {
              it("reverts raffle when you do not pay enough", async function () {
                  await expect(raffle.enterRaffle()).to.be.revertedWithCustomError(
                      raffle,
                      "Raffle__NotEnoughETHEntered",
                  )
              })
              it("records player when they enter", async function () {
                  await raffle.enterRaffle({ value: raffleEntranceFee })
                  const playerFromContract = await raffle.getPlayer(0)
                  assert.equal(playerFromContract, deployer)
              })
              it("emit event on enter", async function () {
                  await expect(raffle.enterRaffle({ value: raffleEntranceFee })).to.emit(
                      raffle,
                      "RaffleEnter",
                  )
              })
              it("doesnt allow entrance when raffle is calculating", async function () {
                  //   let intervalString = interval.toString()
                  //   let intervalBigNumber = new BigNumber(intervalString)
                  //   console.log(typeof intervalBigNumber.toNumber())
                  //   console.log(typeof 1)
                  //   console.log(intervalBigNumber.toNumber() + 1)
                  //   console.log(typeof intervalBigNumber.toNumber())
                  //   const sevenDays = 7 * 24 * 60 * 60
                  await raffle.enterRaffle({ value: raffleEntranceFee })
                  await network.provider.send("evm_increaseTime", [Number(interval) + 1])
                  await network.provider.send("evm_mine", [])
                  console.log(typeof Number(interval))
                  //we pretend to be a chainlink keeper
                  await raffle.performUpkeep("0x")
                  console.log("I see you")
                  await expect(
                      raffle.enterRaffle({ value: raffleEntranceFee }),
                  ).to.be.revertedWithCustomError(raffle, "RaffleState__NotOpen")
              })
          })
          describe("checkupkeep", function () {
              it("returns false if people have not sent any ETH", async function () {
                  await network.provider.send("evm_increaseTime", [Number(interval) + 1])
                  await network.provider.send("evm_mine", [])
                  const { upkeepNeeded } = await raffle.checkUpkeep.staticCall("0x")
                  console.log(upkeepNeeded)
                  assert(!upkeepNeeded)
              })
              it("returns false if raffle isn't open", async function () {
                  await raffle.enterRaffle({ value: raffleEntranceFee })
                  await network.provider.send("evm_increaseTime", [Number(interval) + 1])
                  await network.provider.send("evm_mine", [])
                  await raffle.performUpkeep("0x")
                  const raffleState = await raffle.getRaffleState()
                  const { upkeepNeeded } = await raffle.checkUpkeep.staticCall("0x")
                  console.log(raffleState)
                  assert.equal(raffleState, 1)
                  assert.equal(upkeepNeeded, false)
              })
              it("returns false if enough time has not been passed", async function () {
                  await raffle.enterRaffle({ value: raffleEntranceFee })
                  await network.provider.send("evm_increaseTime", [Number(interval) - 2])
                  await network.provider.request({ method: "evm_mine", params: [] })
                  const { upkeepNeeded } = await raffle.checkUpkeep.staticCall("0x")
                  console.log(upkeepNeeded)
                  assert(!upkeepNeeded)
              })
              it("returns true if enough time has been passed, has players, ETH, and it is Open", async function () {
                  await raffle.enterRaffle({ value: raffleEntranceFee })
                  await network.provider.send("evm_increaseTime", [Number(interval) + 1])
                  await network.provider.request({ method: "evm_mine", params: [] })
                  const { upkeepNeeded } = await raffle.checkUpkeep.staticCall("0x")
                  assert(upkeepNeeded)
              })
          })
          describe("performUpkeep", function () {
              it("it can only run if checkUpkeep is true", async function () {
                  await raffle.enterRaffle({ value: raffleEntranceFee })
                  await network.provider.send("evm_increaseTime", [Number(interval) + 1])
                  await network.provider.send("evm_mine", [])
                  const tx = await raffle.performUpkeep("0x")
                  //   console.log(tx)
                  assert(tx)
              })
              it("reverts when checkupkeep is false", async function () {
                  await expect(raffle.performUpkeep("0x")).to.be.revertedWithCustomError(
                      raffle,
                      "Raffle_UpKeepNotNeeded",
                  )
              })
              it("updates the raffle state, emits and event, and calls the vrf coordinator", async function () {
                  await raffle.enterRaffle({ value: raffleEntranceFee })
                  await network.provider.send("evm_increaseTime", [Number(interval) + 1])
                  await network.provider.send("evm_mine", [])
                  const txRes = await raffle.performUpkeep("0x")
                  const txReceipt = await txRes.wait(1)
                  //   console.log(txReceipt)
                  const raffleState = await raffle.getRaffleState()
                  const requestId = await txReceipt.logs[1].args.requestId
                  assert(requestId > 0)
                  console.log(raffleState)
                  assert(raffleState == 1)
              })
          })
          describe("fulfillRandomwords", function () {
              beforeEach(async function () {
                  await raffle.enterRaffle({ value: raffleEntranceFee })
                  await network.provider.send("evm_increaseTime", [Number(interval) + 1])
                  await network.provider.send("evm_mine", [])
              })
              it("can only be called after performUpkeep", async function () {
                  console.log("Hello")
                  await expect(
                      vrfCoordinatorV2Mock.fulfillRandomWords(0, raffle.target),
                  ).to.be.revertedWithoutReason("nonexistent request")
                  console.log("Hi")
                  await expect(
                      vrfCoordinatorV2Mock.fulfillRandomWords(1, raffle.target),
                  ).to.be.revertedWithoutReason("nonexistent request")
              })
              it.only("picks a winner, reset the lottery, and sends the money", async function () {
                  const additionalEntrants = 3
                  const startingAccountIndex = 1
                  const accounts = await ethers.getSigners()
                  for (
                      let i = startingAccountIndex;
                      i < additionalEntrants + startingAccountIndex;
                      i++
                  ) {
                      const accountConnectedRaffle = raffle.connect(accounts[i])
                      await accountConnectedRaffle.enterRaffle({ value: raffleEntranceFee })
                  }
                  const startingTimeStamp = await raffle.getLatestTimeStamp()
                  //performUpkeep (mock being chainink keeper)
                  //fulfillRandomWords(mock being chainlink VRF)
                  //We will have to wait for the fulfillRandomwords to be called
                  console.log("starting")
                  await new Promise(async (resolve, reject) => {
                      console.log("I see you")
                      console.log(raffleContractAddress)
                      console.log(typeof raffleContractAddress)
                      raffle.once("WinnerPicked", async () => {
                          console.log("Found the event")
                          try {
                              console.log(accounts[0].address)
                              console.log(accounts[1].address)
                              console.log(accounts[2].address)
                              console.log(accounts[3].address)
                              const recentWinner = await raffle.getRecentWinner()
                              console.log(recentWinner)
                              const raffleState = await raffle.getRaffleState()
                              const endingTimeStamp = await raffle.getLatestTimeStamp()
                              const numOfPlayers = await raffle.getNumOfPlayers()
                              const winnerEndingBalance = await accounts[1].getBalanace()
                              assert.equal(numOfPlayers, 0)
                              assert.equal(raffleState, 0)
                              assert(endingTimeStamp > startingTimeStamp)
                              assert(
                                  winnerEndingBalance,
                                  winnerStartingBalance.add(
                                      raffleEntranceFee
                                          .mul(additionalEntrants)
                                          .add(raffleEntranceFee),
                                  ),
                              )
                          } catch (e) {
                              reject(e)
                          }
                          resolve()
                      })
                      //setting up the listening
                      //below, we will fire up the event, and the listener will pick it up, and resolve
                      const tx = await raffle.performUpkeep("0x")
                      const txReceipt = await tx.wait(1)
                      const winnerStartingBalance = await accounts[1].getBalanace()
                      await vrfCoordinatorV2Mock.fulfillRandomWords(
                          txReceipt.logs[1].args.requestId,
                          raffle.target,
                      )
                  })
              })
          })
      })
