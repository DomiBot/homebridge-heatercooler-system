const fs = require("fs");
const path = require("path");
const storage = require("node-persist");
const { spawn } = require("child_process");
const fetch = require("node-fetch");
const express = require("express");
const rateLimit = require("express-rate-limit");

const packageJson = require("../package.json");
const options = require("./utils/options.js");


const app = express();
let Service, Characteristic, storagePath;

module.exports = function (homebridge) {
	Service = homebridge.hap.Service;
	Characteristic = homebridge.hap.Characteristic;
	storagePath = homebridge.user.storagePath();

	homebridge.registerAccessory(
		"homebridge-heatercooler-system",
		"heatercooler-system",
		HeaterCooler
	);
};

function HeaterCooler(log, config) {
	this.log = log;
	options.init(log, config);
	this.config = config
	this.current = 18.5
	this.cooling = 19
	this.heating = 25.5
	this.mode = 1
	this.active = 0

  

	// Security system
	this.service = new Service.HeaterCooler(options.name);
	this.service.getCharacteristic(Characteristic.Active)
		.on('get', this.handleActiveGet.bind(this))
		.on('set', this.handleActiveSet.bind(this));
	this.service.getCharacteristic(Characteristic.CurrentHeaterCoolerState)
		.on('get', this.handleCurrentHeaterCoolerStateGet.bind(this));
	this.service.getCharacteristic(Characteristic.TargetHeaterCoolerState)
		.on('get', this.handleTargetHeaterCoolerStateGet.bind(this))
		.on('set', this.handleTargetHeaterCoolerStateSet.bind(this));
	this.service.getCharacteristic(Characteristic.CurrentTemperature)
		.on('get', this.handleCurrentTemperatureGet.bind(this));
	this.service.getCharacteristic(Characteristic.CoolingThresholdTemperature)
		.on('get', this.handleCoolingThresholdTemperatureGet.bind(this))
		.on('set', this.handleCoolingThresholdTemperatureSet.bind(this));
	this.service.getCharacteristic(Characteristic.HeatingThresholdTemperature)
		.on('get', this.handleHeatingThresholdTemperatureGet.bind(this))
		.on('set', this.handleHeatingThresholdTemperatureSet.bind(this));
	this.service.getCharacteristic(Characteristic.CoolingThresholdTemperature).props.minValue = 5;
	this.service.getCharacteristic(Characteristic.CoolingThresholdTemperature).props.maxValue = 30;
	this.service.getCharacteristic(Characteristic.HeatingThresholdTemperature).props.minValue = 5;
	this.service.getCharacteristic(Characteristic.HeatingThresholdTemperature).props.maxValue = 30;
	this.service.getCharacteristic(Characteristic.CoolingThresholdTemperature).props.minStep = 0.5;
	this.service.getCharacteristic(Characteristic.HeatingThresholdTemperature).props.minStep = 0.5;

	// Accessory information
	this.accessoryInformationService = new Service.AccessoryInformation();

	this.accessoryInformationService.setCharacteristic(
		Characteristic.Identify,
		true
	);
	this.accessoryInformationService.setCharacteristic(
		Characteristic.Manufacturer,
		"Domi"
	);
	this.accessoryInformationService.setCharacteristic(
		Characteristic.Model,
		"DIY"
	);
	this.accessoryInformationService.setCharacteristic(
		Characteristic.Name,
		"homebridge-heatercoolerdomi"
	);
	this.accessoryInformationService.setCharacteristic(
		Characteristic.SerialNumber,
		"S3CUR1TYSYST3M"
	);
	this.accessoryInformationService.setCharacteristic(
		Characteristic.FirmwareRevision,
		packageJson.version
	);

	// Services list
	this.services = [this.service, this.accessoryInformationService];

  

	
	setInterval(() => {
		fetch("http://" + this.config.ip + ":8080/" + this.config.token + "/get/V" + this.config.pin)
			.then((response) => response.json())
			.then((data) =>  {  
				this.current = data[0]
				this.service.updateCharacteristic(Characteristic.CurrentTemperature, data[0])
				this.cooling = data[1]
				this.service.updateCharacteristic(Characteristic.CoolingThresholdTemperature, data[1])
				this.heating = data[2]
				this.service.updateCharacteristic(Characteristic.HeatingThresholdTemperature, data[2])
				this.mode = data[3]
				switch(data[3]){
					case "1":
						this.modec = 2
						break;
					case "2":
						this.modec = 3
						break;
				}
				this.service.updateCharacteristic(Characteristic.CurrentHeaterCoolerState, this.modec)
				this.service.updateCharacteristic(Characteristic.TargetHeaterCoolerState, data[3])
				this.active = data[4]
				this.service.updateCharacteristic(Characteristic.Active, data[4])
			})
				.catch((error) => {
					this.log.error(`Request to webhook failed. (${path})`);
					this.log.error(error);
			});
	}, 1000);
		
	

  
}

HeaterCooler.prototype.handleActiveGet = function (callback) {
	callback(null, this.active);
}
HeaterCooler.prototype.handleActiveSet = function (value, callback) {
	this.sendDataFromSet(value, "Active")
	callback(null);
}
HeaterCooler.prototype.handleCurrentHeaterCoolerStateGet = function (callback) {
	callback(null, this.mode);
}

HeaterCooler.prototype.handleTargetHeaterCoolerStateGet = function (callback) {
	callback(null, this.mode);
}
HeaterCooler.prototype.handleTargetHeaterCoolerStateSet = function (value, callback) {
	this.sendDataFromSet(value, "Mode")
	callback(null);
}
HeaterCooler.prototype.handleCurrentTemperatureGet = function (callback) {
	callback(null, this.current);
}
HeaterCooler.prototype.handleCoolingThresholdTemperatureGet = function (callback) {
	callback(null, this.cooling);
}
HeaterCooler.prototype.handleCoolingThresholdTemperatureSet = function (value, callback) {
	this.sendDataFromSet(value, "Cooling")
	callback(null);
}
HeaterCooler.prototype.handleHeatingThresholdTemperatureGet = function (callback) {
	callback(null, this.heating);
}
HeaterCooler.prototype.handleHeatingThresholdTemperatureSet = function (value, callback) {
	this.sendDataFromSet(value, "Heating")
	callback(null);
}


HeaterCooler.prototype.sendDataFromSet = function (value, where){
	switch(where) {
		case "Cooling":
			this.cooling = value;
			break;
		case "Heating":
			this.heating = value;
			break;
		case "Mode":
			this.mode = value;
			break;
		case "Active":
			this.active = value;
			break;
	}
	
	let data = String(this.current) + "\",\"" + String(this.cooling) + "\",\"" + String(this.heating) + "\",\"" + String(this.mode) + "\",\"" + String(this.active);
	
	fetch("http://" + this.config.ip + ":8080/" + this.config.token + "/update/V" + this.config.pin + "?value=" + data)
		.then((response) => {  
			if (response.ok === false) {
				throw new Error(`Status code (${response.status})`);
			}
		})
			.catch((error) => {
				this.log.error(`Request to webhook failed. (${path})`);
				this.log.error(error);
		});
}

HeaterCooler.prototype.getServices = function () {
	return this.services;
};

