const pool = require('../dbConnection');
var logger = require('morgan');

async function getDoctorPatients(doctorId) {
	logger.info(["getDoctorPatients :: START", doctorId])
	let connection = null;
	try {
		connection = await pool.getConnection();
		let values = [doctorId];

		var sql = "SELECT p.* FROM doctors_patients dp INNER JOIN patient p ON dp.patient_id = p.id WHERE dp.doctor_id = ?";
		const [results, fields] = await connection.query(sql, values);
		logger.info(results);
		connection.release();
		return results;
	} catch (error) {
		logger.error('Error connecting to the MySQL server:', error);
		return null;
	}
}