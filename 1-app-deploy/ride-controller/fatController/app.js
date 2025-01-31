/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: MIT-0
 */


// James Beswick, AWS Serverless Team - @jbeswick for help/questions.
// This isn't part of the workshop, but feel free to look around...

const { getRides, updateRide } = require('./ddb')
const { sendSNS } = require('./sns')

exports.handler = async (event) => {
    const rides = await getRides()
    const ridesMessages = []

    await Promise.all(
      rides.map( async ride => {
        const updatedRide = updateRideState(ride)
        await updateRide(updatedRide)

        ridesMessages.push({
          rideId: ride.ID,
          inService: ride.inService,
          wait: ride.wait,
          lastUpdated: ride.lastUpdated
        })
      })
    )

    // Push new ride times to messaging table
    await sendSNS({
      type: "summary",
      msg: JSON.stringify(ridesMessages)
    })
}

/* Simple algorithm to change ride times every minute and
  randomly close rides.
*/

const updateRideState = (ride => {

  if (ride.wait === 0) {
    ride.inService = true
  }

  // Maintenance/closure of ride
  if (ride.inService) {
    if (Math.random() < ride.closureProbability) {
      ride.inService = false
      ride.wait = (5 * ride.waitChangeRate)
      ride.targetWait = 0
      console.log(`${ride.ID}: Closure on ride`)
      return ride
    }
  }

  // If current wait is current target wait, set new targetWait
  if (ride.wait === ride.targetWait) {
      ride.targetWait = Math.floor(Math.random()*ride.maxWait)
      console.log(`${ride.ID}: New target wait: ${ride.targetWait}`)
  }

  // Move wait towards targetWait
  if (ride.wait < ride.targetWait) {
    ride.wait += ride.waitChangeRate
    ride.wait = Math.min(ride.wait, ride.targetWait)
  } else {
    ride.wait -= ride.waitChangeRate
    ride.wait = Math.max(ride.wait, ride.targetWait)
  }
  return ride
})
