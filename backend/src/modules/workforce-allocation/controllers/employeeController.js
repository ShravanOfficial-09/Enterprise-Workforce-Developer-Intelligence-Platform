const employeeRepository = require('../repositories/employeeRepository');

exports.list = async (req, res, next) => {
  try {
    const employees = await employeeRepository.list();
    return res.json({ data: employees });
  } catch (err) {
    return next(err);
  }
};

exports.create = async (req, res, next) => {
  try {
    const employee = await employeeRepository.create(req.body);
    return res.status(201).json({ data: employee });
  } catch (err) {
    return next(err);
  }
};

exports.getById = async (req, res, next) => {
  try {
    const employee = await employeeRepository.getById(req.params.id);
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }
    return res.json({ data: employee });
  } catch (err) {
    return next(err);
  }
};

exports.update = async (req, res, next) => {
  try {
    const employee = await employeeRepository.update(req.params.id, req.body);
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }
    return res.json({ data: employee });
  } catch (err) {
    return next(err);
  }
};

exports.remove = async (req, res, next) => {
  try {
    const employee = await employeeRepository.remove(req.params.id);
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }
    return res.status(204).send();
  } catch (err) {
    return next(err);
  }
};
