// Version: 1.0056
function validatePhone(phone) {
  return /^\+?\d{10,15}$/.test(phone);
}

function validatePassword(password) {
  return password && password.length >= 6 && password.length <= 50;
}

function validateName(name) {
  return name && name.length >= 2 && name.length <= 50;
}

function validateGender(gender) {
  return gender === 'male' || gender === 'female';
}

function validateCustomName(name) {
  return name && name.length <= 20;
}

module.exports = {
  validatePhone,
  validatePassword,
  validateName,
  validateGender,
  validateCustomName
};
