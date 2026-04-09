const express = require("express");
const router = express.Router();

const authMiddleware = require("../../middlewares/auth.middleware");
const {
    createGroup,
    joinGroup,
    getMyGroups,
    getSingleGroup,
    addMember,
    updateGroup,
    leaveGroup,
    deleteGroup,
    getGroupDetails,
    joinGroupByInvite,
    sendInvite,
    respondInvite,
    getMyInvites,
    getSidebarData,
    getInviteInfo
} = require("./group.controller");

// Create a new group
router.post("/", authMiddleware, createGroup);

// Static routes BEFORE parameterized /:groupId routes
router.get("/invites", authMiddleware, getMyInvites);
router.get("/sidebar", authMiddleware, getSidebarData);
router.post("/join/:token", authMiddleware, joinGroupByInvite);
router.get("/invite/:token/info", authMiddleware, getInviteInfo);
router.post("/invite/:inviteId/respond", authMiddleware, respondInvite);

// Join an existing group
router.post("/:groupId/join", authMiddleware, joinGroup);
router.post("/:groupId/leave", authMiddleware, leaveGroup);
router.put("/:groupId", authMiddleware, updateGroup);
router.delete("/:groupId", authMiddleware, deleteGroup);
router.get("/:groupId", authMiddleware, getGroupDetails);
router.post("/:groupId/invite", authMiddleware, sendInvite);

// Get all groups of logged-in user
router.get("/", authMiddleware, getMyGroups);
router.get("/:groupId", authMiddleware, getSingleGroup);
router.post("/:groupId/add-member", authMiddleware, addMember);

module.exports = router;
