/**
 * Roles that work across the whole plant (or company) rather than inside one
 * department — they never carry a department. Mirrors src/lib/roleDepartment.ts
 * (a parity test keeps the two lists equal).
 */
const ROLES_WITHOUT_DEPARTMENT = ["admin", "plant_manager", "store_keeper", "hr_officer", "safety_officer"];

/**
 * @param {string|null|undefined} role a user role
 * @return {boolean} whether this role belongs to a department
 */
function roleHasDepartment(role) {
  return !ROLES_WITHOUT_DEPARTMENT.includes(role);
}

/**
 * @param {string|null|undefined} role a user role
 * @param {string|null|undefined} department the department on the profile
 * @return {string|null} the department to keep — always null for plant-wide roles
 */
function departmentForRole(role, department) {
  if (!roleHasDepartment(role)) return null;
  return (typeof department === "string" && department.trim()) || null;
}

module.exports = {ROLES_WITHOUT_DEPARTMENT, roleHasDepartment, departmentForRole};
