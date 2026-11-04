/**
 * Who a staff-request sender may address (mirrors canAddressRecipient in
 * src/lib/staffRequestInbox.ts):
 *  - technician / trainee / floor operator: supervisors of their own plant and
 *    department, plant managers of their plant, admins;
 *  - supervisor: supervisors of ANY department in their plant (to hand a
 *    matter to another department), plant managers of their plant, admins;
 *  - plant manager: admins.
 */

const RECIPIENT_ROLES = {
  plant_manager: ["admin"],
  supervisor: ["supervisor", "plant_manager", "admin"],
};
const DEFAULT_RECIPIENT_ROLES = ["supervisor", "plant_manager", "admin"];

const normDept = (v) => String(v || "").trim().replace(/\s+/g, " ").toLowerCase();

/**
 * @param {{id:string,role:string,plantId:?string,department:?string}} me the sender
 * @param {{id:string,role:string,plantId:?string,department:?string,status:?string}} u a possible recipient
 * @return {boolean} whether the sender may address the person
 */
function canAddress(me, u) {
  if (u.id === me.id || u.status === "inactive") return false;
  if (u.role === "admin") return me.role !== "admin";
  if ((u.plantId || null) !== (me.plantId || null)) return false;
  if (u.role === "plant_manager") return me.role !== "plant_manager";
  if (u.role !== "supervisor") return false;
  if (me.role === "supervisor") return true;
  const myDept = normDept(me.department);
  return !!myDept && normDept(u.department) === myDept;
}

module.exports = {RECIPIENT_ROLES, DEFAULT_RECIPIENT_ROLES, canAddress};
