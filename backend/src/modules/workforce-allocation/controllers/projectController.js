const projectRepository = require('../repositories/projectRepository');

exports.list = async (req, res, next) => {
  try {
    const projects = await projectRepository.list();
    return res.json({ data: projects });
  } catch (err) {
    return next(err);
  }
};

exports.create = async (req, res, next) => {
  try {
    const project = await projectRepository.create(req.body);
    return res.status(201).json({ data: project });
  } catch (err) {
    return next(err);
  }
};

exports.getById = async (req, res, next) => {
  try {
    const project = await projectRepository.getById(req.params.id);
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }
    return res.json({ data: project });
  } catch (err) {
    return next(err);
  }
};

exports.update = async (req, res, next) => {
  try {
    const project = await projectRepository.update(req.params.id, req.body);
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }
    return res.json({ data: project });
  } catch (err) {
    return next(err);
  }
};

exports.remove = async (req, res, next) => {
  try {
    const project = await projectRepository.remove(req.params.id);
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }
    return res.status(204).send();
  } catch (err) {
    return next(err);
  }
};
