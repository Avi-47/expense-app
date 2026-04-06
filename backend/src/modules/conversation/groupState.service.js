const { redisClient } = require("../../config/redis");

const GROUP_STATE_PREFIX = "group_state:";

const getKey = (groupId) => `${GROUP_STATE_PREFIX}${groupId}`;

async function getGroupState(groupId) {
  const data = await redisClient.get(getKey(groupId));
  return data ? JSON.parse(data) : { pendingExpense: null };
}

async function setGroupState(groupId, state) {
  await redisClient.set(getKey(groupId), JSON.stringify(state));
}

async function clearPendingExpense(groupId) {
  const state = await getGroupState(groupId);
  state.pendingExpense = null;
  await setGroupState(groupId, state);
}

module.exports = {
  getGroupState,
  setGroupState,
  clearPendingExpense
};