const express = require("express");
const crypto = require("crypto");
const router = express.Router();

const authMiddleware = require("../../middlewares/auth.middleware");

const { confirmExpense, deleteExpense, editExpense } = require("./confirm-expense.controller");

const IDEMPOTENCY_WINDOW_MS = 15 * 1000;
const requestWindow = new Map();

const toMoney = (value) => Number(Number(value || 0).toFixed(2));
const toUserId = (value) => String(value || "").trim();

const badRequest = (res, message) => res.status(400).json({ message });
const conflict = (res, message) => res.status(409).json({ message });

const requireExpenseIdParam = (req, res, next) => {
	const expenseId = toUserId(req.params.expenseId);
	if (!expenseId) {
		return badRequest(res, "expenseId is required");
	}
	req.params.expenseId = expenseId;
	return next();
};

const requireGroupIdParam = (req, res, next) => {
	const groupId = toUserId(req.params.groupId);
	if (!groupId) {
		return badRequest(res, "groupId is required");
	}
	req.params.groupId = groupId;
	return next();
};

const validateExpensePayload = (req, res, next) => {
	const { amount, involvedUsers, payers } = req.body || {};

	if (amount === undefined || amount === null || Number(amount) <= 0) {
		return badRequest(res, "amount must be greater than 0");
	}

	if (!Array.isArray(involvedUsers) || involvedUsers.length === 0) {
		return badRequest(res, "involvedUsers must be a non-empty array");
	}

	if (!Array.isArray(payers) || payers.length === 0) {
		return badRequest(res, "payers must be a non-empty array");
	}

	for (const payer of payers) {
		if (!payer || payer.user === undefined || payer.user === null || toUserId(payer.user) === "") {
			return badRequest(res, "each payer must include user");
		}

		if (payer.amount === undefined || payer.amount === null || Number(payer.amount) <= 0) {
			return badRequest(res, "each payer amount must be greater than 0");
		}
	}

	return next();
};

const normalizeExpensePayload = (req, res, next) => {
	const body = req.body || {};
	const amount = toMoney(body.amount);
	const description = typeof body.description === "string" ? body.description.trim() : "";

	const normalizedInvolvedUsers = [...new Set((body.involvedUsers || []).map(toUserId).filter(Boolean))];
	if (normalizedInvolvedUsers.length === 0) {
		return badRequest(res, "involvedUsers must include at least one valid user");
	}

	const payerMap = new Map();
	for (const rawPayer of body.payers || []) {
		const user = toUserId(rawPayer.user);
		if (!user) {
			return badRequest(res, "payer user is invalid");
		}

		const roundedAmount = toMoney(rawPayer.amount);
		if (roundedAmount <= 0) {
			return badRequest(res, "each payer amount must be greater than 0");
		}

		payerMap.set(user, toMoney((payerMap.get(user) || 0) + roundedAmount));
	}

	const normalizedPayers = [...payerMap.entries()].map(([user, payerAmount]) => ({
		user,
		amount: toMoney(payerAmount)
	}));

	if (normalizedPayers.length === 0) {
		return badRequest(res, "payers must include at least one valid payer");
	}

	const payerTotal = toMoney(normalizedPayers.reduce((sum, payer) => sum + payer.amount, 0));
	if (payerTotal !== amount) {
		return badRequest(res, `total payer amount (${payerTotal}) must equal amount (${amount})`);
	}

	req.body = {
		...body,
		description,
		amount,
		involvedUsers: normalizedInvolvedUsers,
		payers: normalizedPayers
	};

	return next();
};

const getIdempotencyKey = (req) => {
	const base = {
		route: req.route ? req.route.path : req.path,
		method: req.method,
		groupId: req.params.groupId || null,
		expenseId: req.params.expenseId || null,
		description: req.body && typeof req.body.description === "string" ? req.body.description : "",
		amount: req.body ? req.body.amount : null,
		involvedUsers: req.body && Array.isArray(req.body.involvedUsers)
			? [...req.body.involvedUsers].map(toUserId).sort()
			: [],
		payers: req.body && Array.isArray(req.body.payers)
			? [...req.body.payers]
				.map((payer) => ({ user: toUserId(payer.user), amount: toMoney(payer.amount) }))
				.sort((a, b) => a.user.localeCompare(b.user) || a.amount - b.amount)
			: []
	};

	return crypto.createHash("sha256").update(JSON.stringify(base)).digest("hex");
};

const idempotencyCheck = (req, res, next) => {
	const now = Date.now();

	for (const [key, ts] of requestWindow.entries()) {
		if (now - ts > IDEMPOTENCY_WINDOW_MS) {
			requestWindow.delete(key);
		}
	}

	const requestHash = getIdempotencyKey(req);
	const previousTs = requestWindow.get(requestHash);
	if (previousTs && now - previousTs <= IDEMPOTENCY_WINDOW_MS) {
		return conflict(res, "Duplicate request detected");
	}

	requestWindow.set(requestHash, now);
	return next();
};

router.post(
	"/:groupId/confirm",
	authMiddleware,
	requireGroupIdParam,
	validateExpensePayload,
	normalizeExpensePayload,
	idempotencyCheck,
	confirmExpense
);

router.put(
	"/:expenseId",
	authMiddleware,
	requireExpenseIdParam,
	validateExpensePayload,
	normalizeExpensePayload,
	idempotencyCheck,
	editExpense
);

router.delete(
	"/:expenseId",
	authMiddleware,
	requireExpenseIdParam,
	idempotencyCheck,
	deleteExpense
);

module.exports = router;
