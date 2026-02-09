const Project = require('../models/Project');

const list = async (filter = {}) => Project.find(filter).sort({ createdAt: -1 });

const create = async (data) => Project.create(data);

const getById = async (id) => Project.findById(id);

const update = async (id, data) => Project.findByIdAndUpdate(id, data, { new: true, runValidators: true });

const remove = async (id) => Project.findByIdAndDelete(id);

module.exports = { list, create, getById, update, remove };
