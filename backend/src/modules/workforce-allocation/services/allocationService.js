const Employee = require('../models/Employee');

const getSuggestionsForProject = async (project, organizationId) => {
  const requiredSkills = project.requiredSkills || [];
  const requiredUnits =
    project.expectedWorkload && project.expectedWorkload.units
      ? project.expectedWorkload.units
      : 0;

  const pipeline = [
    {
      $match: {
        organizationId,
        isAllocatable: true,
        availabilityStatus: { $in: ['available', 'partially_available'] }
      }
    },

    // Capacity feasibility check
    {
      $addFields: {
        remainingCapacity: {
          $subtract: ['$capacity.limit', '$capacity.allocated']
        }
      }
    },
    {
      $match: {
        remainingCapacity: { $gte: requiredUnits }
      }
    },

    // Skill evaluation
    {
      $addFields: {
        skillEvaluation: {
          required: requiredSkills.length,
          matched: {
            $size: {
              $filter: {
                input: requiredSkills,
                as: 'req',
                cond: {
                  $let: {
                    vars: {
                      empSkill: {
                        $first: {
                          $filter: {
                            input: '$skills',
                            as: 's',
                            cond: {
                              $eq: ['$$s.skillKey', '$$req.skillKey']
                            }
                          }
                        }
                      }
                    },
                    in: {
                      $and: [
                        { $ne: ['$$empSkill', null] },
                        {
                          $gte: [
                            '$$empSkill.proficiency',
                            '$$req.minProficiency'
                          ]
                        }
                      ]
                    }
                  }
                }
              }
            }
          }
        }
      }
    },

    // Explanation builder
    {
      $addFields: {
        allocationSummary: {
          meetsAllSkills: {
            $eq: ['$skillEvaluation.matched', '$skillEvaluation.required']
          },
          capacitySufficient: true,
          availabilityStatus: '$availabilityStatus'
        }
      }
    },

    // Only suggest employees who meet minimum skill criteria
    {
      $match: {
        'allocationSummary.meetsAllSkills': true
      }
    },

    {
      $project: {
        fullName: 1,
        roleKey: 1,
        departmentKey: 1,
        availabilityStatus: 1,
        remainingCapacity: 1,
        allocationSummary: 1
      }
    },

    { $limit: 20 }
  ];

  return Employee.aggregate(pipeline);
};

module.exports = { getSuggestionsForProject };
