import "babel-polyfill"
import BigNumber from "bignumber.js"
import FlightSuretyApp from '../../build/contracts/FlightSuretyApp.json'
import Config from './config.json'
import Web3 from 'web3'
import express from 'express'

/**
 * Contract configuration
 */
let config = Config['localhost']
let web3 = new Web3(new Web3.providers.WebsocketProvider(config.url.replace('http', 'ws')))
let flightSuretyApp = new web3.eth.Contract(FlightSuretyApp.abi, config.appAddress)
let accounts = null

/**
 * Oracles
 */
let oracles = []

///////////////////////////////////////////////////////////////////////////////
// Initialization
///////////////////////////////////////////////////////////////////////////////

/**
 * Retrieving accounts
 */
web3.eth.getAccounts(function(err, res) {
    if (err) {
        console.log('Error:',err)
        return
    }
    accounts = res
    console.log(accounts)
    registerOracles()
})

/**
 * Register some oracles
 */
const registerOracles = async () => {
	let maxOracleNumber = 30

	for (let i = 0; i < maxOracleNumber; ++i) {
		let account = accounts[i]

		try { // Register an oracle in the contract
			console.log(
				'Registering Oracle:', account,
				'Balance:', await web3.eth.getBalance(account)
			)
			let receipt = await flightSuretyApp.methods.registerOracle().send
			({
				from: account,
				value: web3.utils.toWei('1', 'ether'),
				gas: 6721975
			})
		}

		catch (err) {
			console.log(err)
		}
	}
}

///////////////////////////////////////////////////////////////////////////////
// Events handler
///////////////////////////////////////////////////////////////////////////////

/**
 * App registered an Oracle
 */
const onOracleRegistered = (error, event) => {
    if (error) {
    	console.log('Error:', error)
    }

    console.log('Oracle registered, address:',
    	'address: ' + event.returnValues.oracle,
    	'indexes: ' + [event.returnValues.id1, event.returnValues.id2,
    				   event.returnValues.id3]
    )

    // Save the oracle
    oracles.push({
    	address: event.returnValues.oracle,
    	indexes: [event.returnValues.id1, event.returnValues.id2, event.returnValues.id3]
    })
}

/**
 * App request flight status update from Oracles
 */
const onOracleRequest = (error, event) => {
	if (error) {
		return console.log(error)
	}

	let index = event.returnValues.index // Get the id requested from the contract
	console.log('onOracleRequest',
		index,
		event.returnValues.airline,
		event.returnValues.flight,
		event.returnValues.timestamp
	)

	oracles.forEach(async (oracle) => { // Find Oracles which match the requested index
		if (oracle.indexes.indexOf(index) !== -1) { // We have a match
			console.log('Match oracle:', oracle.address, oracle.indexes)

			let randomStatusCode = intRandom(0, 5) // Generate a random status code for each oracle
			randomStatusCode *= 10

			try { // Send a random flight status to the smart contract
				let receipt = await flightSuretyApp.methods.submitOracleResponse
				(
					index,
					event.returnValues.airline,
					event.returnValues.flight,
					event.returnValues.timestamp,
					randomStatusCode
				)
				.send({
					from: oracle.address,
					gas: 6721975
				})
			}

			catch (err) {
				console.log(err)
			}
		}
	})
}

///////////////////////////////////////////////////////////////////////////////
// Contracts events
///////////////////////////////////////////////////////////////////////////////

/**
 * An oracle has been registered
 */
flightSuretyApp.events.OracleRegistered({
	fromBlock: 0
}, onOracleRegistered)

/**
 * App request flight status update from Oracles
 */
flightSuretyApp.events.OracleRequest({
	fromBlock: 0
}, onOracleRequest)

// ----------------------------------------------------------------------------

/**
 * DEBUG Only - The contract properly received oracle flight status response
 */
flightSuretyApp.events.OracleReport({
	fromBlock: 0
}, (error, event) => {
	if (error) {
		return console.log(error)
	} else {
		console.log("OracleReport",
			'airline:' + event.returnValues.airline,
			'flight:' + event.returnValues.flight,
			'timestamp:' + event.returnValues.timestamp,
			'status:' + event.returnValues.status
		)
	}
})

// ----------------------------------------------------------------------------

/**
 * DEBUG Only - Enough oracle returned the same status code for the
 * request flight
 */
flightSuretyApp.events.FlightStatusInfo({
	fromBlock: 0
}, (error, event) => {
	if (error) {
		return console.log(error)
	} else {
		console.log("######################### FlightStatusInfo #########################\n",
			'airline:' + event.returnValues.airline,
			'flight:' + event.returnValues.flight,
			'timestamp:' + event.returnValues.timestamp,
			'status:' + event.returnValues.status,
			"\n######################### /FlightStatusInfo #########################\n"
		)
	}
})

///////////////////////////////////////////////////////////////////////////////
// Utils
///////////////////////////////////////////////////////////////////////////////

const intRandom = (min, max) => {
   min = Math.ceil(min);
   max = Math.floor(max);
   return Math.floor(Math.random() * (max - min + 1)) + min;
}

///////////////////////////////////////////////////////////////////////////////
// API
///////////////////////////////////////////////////////////////////////////////

const app = express()
app.get('/api', (req, res) => {
    res.send({
      message: 'An API for use with your Dapp!'
    })
})

export default app

