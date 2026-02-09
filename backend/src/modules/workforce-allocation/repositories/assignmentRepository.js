const Assignment = require('../models/Assignment');

const listByProject = async (projectId) => Assignment.find({ projectId }).sort({ createdAt: -1 });

const listByEmployee = async (employeeId) => Assignment.find({ employeeId }).sort({ createdAt: -1 });

const create = async (data) => Assignment.create(data);

const getById = async (id) => Assignment.findById(id);

const updateById = async (id, update) => Assignment.findByIdAndUpdate(id, update, { new: true, runValidators: true });

module.exports = { listByProject, listByEmployee, create, getById, updateById };
