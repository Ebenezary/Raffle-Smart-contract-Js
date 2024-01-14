const { deployments, ethers, getNamedAccounts, network } = require("hardhat")
const { developmentChains, networkConfig } = require("../../helper-hardhat-config")
const { assert, expect } = require("chai")
const BigNumber = require("bignumber.js")
const { time, helpers } = require("@nomicfoundation/hardhat-network-helpers")

developmentChains.includes(network.name)
    ? describe.skip
    : describe("Raffle Unit Tests", function () {
          let raffle,
              raffleContractAddress,
              raffleEntranceFee,
              deployer,
              interval,
              raffleContractAddressS
          beforeEach(async function () {
              deployer = (await getNamedAccounts()).deployer
              raffleContractAddress = (await deployments.get("Raffle")).address
              raffleContractAddressS = "0xde4C3F08A3bd5e529c1008C0D50C007Baa1232c6"
              raffle = await ethers.getContractAt("Raffle", raffleContractAddress)
              raffleEntranceFee = await raffle.getEntranceFee()
          })
          describe("fulfillRandomwords", function () {
              it("It works with live Chainlink keepers and Chainlink VRF, we get a random winner", async () => {
                  //Enter the Raffle
                  console.log(raffleContractAddress)

                  const accounts = await ethers.getSigners()
                  const startingTimeStamp = await raffle.getLatestTimeStamp()

                  await new Promise(async (resolve, reject) => {
                      //Set up the listener, before we enter the raffle
                      //just in case the blockchain moves really fast
                      console.log(raffleContractAddress)

                      raffle.once("WinnerPicked", async () => {
                          console.log("WinnerPicked event fired!")
                          try {
                              const recentWinner = await raffle.getRecentWinner()
                              const raffleState = await raffle.getRaffleState()
                              const winnerEndingBalance = await accounts[0].getBalance()
                              const endingTimeStamp = await raffle.getLatestTimeStamp()

                              await expect(raffle.getPlayer(0)).to.be.reverted
                              assert.equal(recentWinner.toString(), address[0].address)
                              assert.equal(raffleState, 0)
                              assert.equal(
                                  winnerEndingBalance,
                                  winnerstartingBalance.add(raffleEntranceFee),
                              )
                              assert(endingTimeStamp > startingTimeStamp)
                              resolve()
                              //add out assert
                          } catch (error) {
                              console.log(error)
                              reject(e)
                          }
                      })
                      //The entering the raffle
                      await raffle.enterRaffle({ value: raffleEntranceFee })
                      const winnerstartingBalance = await accounts[0].getBalance()

                      //And the code won't finish until our listener has finsisng listening
                  })
              })
          })
      })

//1. Get our SubId for chainloink vrf
//2. Deploy our contract using thne subid
//3. Register the contract using the vrf and its subid
//4. Register the contract with chainlink keepers
//5. Run staging test
