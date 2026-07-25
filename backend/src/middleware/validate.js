const { ValidationError } = require("../errors/domainErrors");

function validate(schema, target = "body") {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[target], { abortEarly: false });

    if (error) {
      return next(new ValidationError("Validation failed", error.details));
    }

    req[target] = value;
    return next();
  };
}

module.exports = { validate };
