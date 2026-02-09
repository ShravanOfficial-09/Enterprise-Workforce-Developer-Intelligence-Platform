const Employee = require('../models/Employee');

const list = async (filter = {}) => Employee.find(filter).sort({ createdAt: -1 });

const create = async (data) => Employee.create(data);

const getById = async (id) => Employee.findById(id);

const update = async (id, data) => Employee.findByIdAndUpdate(id, data, { new: true, runValidators: true });

const remove = async (id) => Employee.findByIdAndDelete(id);

module.exports = { list, create, getById, update, remove };
