const pool = require('../dbConnection');
const logger = require('../logger');

const { 
  v1: uuidv1,
  v4: uuidv4,
} = require('uuid');

SandboxRepository = function() {

	this.insertNewSandboxWithSessionUuid = async function (name, owner, sessionuuid) {
		logger.info(["insertNewSandboxWithSessionUuid :: START", name, owner, sessionuuid]);
		try {
			let values = [name, owner, sessionuuid];
			var sql = "INSERT INTO sandboxes (`name`, `ownerId`, `sessionUuid`) VALUES (?, ?, ?)";
			const [results, fields] = await pool.execute(sql, values);
			logger.info(results);
			logger.info(["insertNewSandboxWithSessionUuid :: END", name, owner, sessionuuid]);
			return results;
		} catch (error) {
			logger.error('insertNewSandboxWithSessionUuid ERROR:', error);
			return null;
		}
	}

	this.insertNewSandbox = async function (name, owner) {
		logger.info(["insertNewSandbox :: START", name, owner]);
		var results = this.insertNewSandboxWithSessionUuid(name, owner, uuidv4());
		logger.info(["insertNewSandbox :: END", name, owner]);
		return results;
	}

	this.getSandboxByUuid = async function (uuid) {
		logger.info(["getSandboxByUuid :: START", uuid])
		try {
			let values = [uuid];
			var sql = "SELECT * FROM sandboxes WHERE uuid = ?";
			const [results, fields] = await pool.execute(sql, values);
			logger.info(results);
			logger.info(["getSandboxByUuid :: END", uuid])
			return results[0];
		} catch (error) {
			logger.error('getSandboxByUuid ERROR:', error);
			return null;
		}
	}

	this.getSandboxBySessionUuid = async function (sessionUuid) {
		logger.info(["getSandboxBySessionUuid :: START", sessionUuid])
		try {
			let values = [sessionUuid];
			var sql = "SELECT * FROM sandboxes WHERE sessionUuid = ?";
			const [results, fields] = await pool.execute(sql, values);
			logger.info(results);
			logger.info(["getSandboxBySessionUuid :: END", sessionUuid])
			return results[0];
		} catch (error) {
			logger.error('getSandboxBySessionUuid ERROR:', error);
			return null;
		}
	}

	this.getSandboxById = async function (id) {
		logger.info(["getSandboxById :: START", id])
		try {
			let values = [id];
			var sql = "SELECT * FROM sandboxes WHERE id = ?";
			const [results, fields] = await pool.execute(sql, values);
			logger.info(results);
			logger.info(["getSandboxById :: END", id])
			return results[0];
		} catch (error) {
			logger.error('getSandboxById ERROR:', error);
			return null;
		}
	}

}

exports.SandboxRepository = SandboxRepository;