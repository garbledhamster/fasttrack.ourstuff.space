import { load as loadYaml } from "https://cdn.jsdelivr.net/npm/js-yaml@4.1.0/+esm";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-analytics.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import {
	browserLocalPersistence,
	browserSessionPersistence,
	createUserWithEmailAndPassword,
	getAuth,
	onAuthStateChanged,
	reload,
	sendEmailVerification,
	sendPasswordResetEmail,
	setPersistence,
	signInWithEmailAndPassword,
	signOut,
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import {
	addDoc,
	collection,
	deleteDoc,
	doc,
	getDoc,
	getDocFromServer,
	getFirestore,
	onSnapshot,
	setDoc,
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

const ENCRYPTED_CACHE_KEY = "fastingTrackerEncryptedStateV1";
const WRAPPED_KEY_STORAGE_KEY = "fastingTrackerWrappedKeyV1";
const DEVICE_KEY_DB = "fastingTrackerCryptoKeys";
const DEVICE_KEY_STORE = "keys";
const DEVICE_KEY_ID = "device-wrap-key";
const RING_CIRC = 2 * Math.PI * 80;
const ENCRYPTION_VERSION = 1;
const PBKDF2_ITERATIONS = 310000;
const UI_BULLET_SEPARATOR = " \u2022 ";
const UI_MIDDOT_SEPARATOR = " \u00b7 ";
const UI_ARROW_SEPARATOR = " \u2192 ";
const UI_EM_DASH = "\u2014";
const UI_ELLIPSIS = "\u2026";
const _NOTES_SCHEMA = Object.freeze({
	text: "",
	trainerResponse: "",
	createdAt: 0,
	updatedAt: 0,
	dateKey: "YYYY-MM-DD",
	goalContext: {
		dailyTarget: null,
		goal: "",
		age: null,
		height: null,
		currentWeight: null,
		gender: "",
		fitnessLevel: "",
		nutrientGoals: {},
	},
	fastContext: {
		wasActive: false,
		fastId: null,
		fastTypeId: null,
		fastTypeLabel: null,
		startTimestamp: null,
		plannedDurationHours: null,
	},
	calorieEntry: {
		calories: null,
		foodNote: "",
		macros: {
			protein: null,
			carbs: null,
			fat: null,
		},
		micros: {
			sodium: null,
			potassium: null,
			calcium: null,
			iron: null,
			magnesium: null,
			zinc: null,
		},
		vitamins: {
			vitaminA: null,
			vitaminC: null,
			vitaminD: null,
			vitaminB6: null,
			vitaminB12: null,
		},
		goalSnapshot: {
			dailyTarget: null,
			goal: "",
			age: null,
			height: null,
			currentWeight: null,
			gender: "",
			fitnessLevel: "",
			nutrientGoals: {},
		},
	},
});

let FAST_TYPES = [];
let FASTING_HOURLY = { hours: [], notes: [] };
let CALORIE_TIPS = { goals: [], map: {} };

const DEFAULT_THEME_ID = "midnight";
const DEFAULT_THEME_COLORS = {
	primaryColor: "#06b6d4",
	secondaryColor: "#0891b2",
	backgroundColor: "#020617",
	surfaceColor: "#0f172a",
	surfaceMutedColor: "#1e293b",
	borderColor: "#1e293b",
	textColor: "#f8fafc",
	textMutedColor: "#94a3b8",
	dangerColor: "#dc2626",
};

let THEME_PRESET_LIST = [
	{
		id: DEFAULT_THEME_ID,
		label: "Midnight",
		colors: { ...DEFAULT_THEME_COLORS },
	},
];
let THEME_PRESETS = {
	[DEFAULT_THEME_ID]: {
		label: "Midnight",
		colors: { ...DEFAULT_THEME_COLORS },
	},
};

const CALORIE_VIEWS = [
	{ id: "total", label: "Total" },
	{ id: "consumed", label: "Consumed" },
	{ id: "left", label: "Left" },
];

const MACRO_FIELDS = Object.freeze(["protein", "carbs", "fat"]);
const MICRO_FIELDS = Object.freeze([
	"sodium",
	"potassium",
	"calcium",
	"iron",
	"magnesium",
	"zinc",
]);
const VITAMIN_FIELDS = Object.freeze([
	"vitaminA",
	"vitaminC",
	"vitaminD",
	"vitaminB6",
	"vitaminB12",
]);
const NUTRIENT_TRACKER_DEFINITIONS = Object.freeze([
	{
		key: "protein",
		group: "macros",
		label: "Protein",
		unit: "g",
		shortLabel: "P",
	},
	{ key: "carbs", group: "macros", label: "Carbs", unit: "g", shortLabel: "C" },
	{ key: "fat", group: "macros", label: "Fat", unit: "g", shortLabel: "F" },
	{
		key: "sodium",
		group: "micros",
		label: "Sodium",
		unit: "mg",
		shortLabel: "Na",
	},
	{
		key: "potassium",
		group: "micros",
		label: "Potassium",
		unit: "mg",
		shortLabel: "K",
	},
	{
		key: "calcium",
		group: "micros",
		label: "Calcium",
		unit: "mg",
		shortLabel: "Ca",
	},
	{ key: "iron", group: "micros", label: "Iron", unit: "mg", shortLabel: "Fe" },
	{
		key: "magnesium",
		group: "micros",
		label: "Magnesium",
		unit: "mg",
		shortLabel: "Mg",
	},
	{ key: "zinc", group: "micros", label: "Zinc", unit: "mg", shortLabel: "Zn" },
	{
		key: "vitaminA",
		group: "vitamins",
		label: "Vitamin A",
		unit: "mcg",
		shortLabel: "Vit A",
	},
	{
		key: "vitaminC",
		group: "vitamins",
		label: "Vitamin C",
		unit: "mg",
		shortLabel: "Vit C",
	},
	{
		key: "vitaminD",
		group: "vitamins",
		label: "Vitamin D",
		unit: "mcg",
		shortLabel: "Vit D",
	},
	{
		key: "vitaminB6",
		group: "vitamins",
		label: "Vitamin B6",
		unit: "mg",
		shortLabel: "B6",
	},
	{
		key: "vitaminB12",
		group: "vitamins",
		label: "Vitamin B12",
		unit: "mcg",
		shortLabel: "B12",
	},
]);
const NUTRIENT_GOAL_INPUT_FIELDS = Object.freeze([
	{ id: "calorie-goal-protein", group: "macros", key: "protein" },
	{ id: "calorie-goal-carbs", group: "macros", key: "carbs" },
	{ id: "calorie-goal-fat", group: "macros", key: "fat" },
	{ id: "calorie-goal-sodium", group: "micros", key: "sodium" },
	{ id: "calorie-goal-potassium", group: "micros", key: "potassium" },
	{ id: "calorie-goal-calcium", group: "micros", key: "calcium" },
	{ id: "calorie-goal-iron", group: "micros", key: "iron" },
	{ id: "calorie-goal-magnesium", group: "micros", key: "magnesium" },
	{ id: "calorie-goal-zinc", group: "micros", key: "zinc" },
	{ id: "calorie-goal-vitamin-a", group: "vitamins", key: "vitaminA" },
	{ id: "calorie-goal-vitamin-c", group: "vitamins", key: "vitaminC" },
	{ id: "calorie-goal-vitamin-d", group: "vitamins", key: "vitaminD" },
	{ id: "calorie-goal-vitamin-b6", group: "vitamins", key: "vitaminB6" },
	{ id: "calorie-goal-vitamin-b12", group: "vitamins", key: "vitaminB12" },
]);
const NOTE_EDITOR_NUTRIENT_FIELDS = Object.freeze([
	{ id: "note-editor-protein", group: "macros", key: "protein" },
	{ id: "note-editor-carbs", group: "macros", key: "carbs" },
	{ id: "note-editor-fat", group: "macros", key: "fat" },
	{ id: "note-editor-sodium", group: "micros", key: "sodium" },
	{ id: "note-editor-potassium", group: "micros", key: "potassium" },
	{ id: "note-editor-calcium", group: "micros", key: "calcium" },
	{ id: "note-editor-iron", group: "micros", key: "iron" },
	{ id: "note-editor-magnesium", group: "micros", key: "magnesium" },
	{ id: "note-editor-zinc", group: "micros", key: "zinc" },
	{ id: "note-editor-vitamin-a", group: "vitamins", key: "vitaminA" },
	{ id: "note-editor-vitamin-c", group: "vitamins", key: "vitaminC" },
	{ id: "note-editor-vitamin-d", group: "vitamins", key: "vitaminD" },
	{ id: "note-editor-vitamin-b6", group: "vitamins", key: "vitaminB6" },
	{ id: "note-editor-vitamin-b12", group: "vitamins", key: "vitaminB12" },
]);

function buildDefaultNutrientGoals() {
	return {
		macros: Object.fromEntries(MACRO_FIELDS.map((field) => [field, null])),
		micros: Object.fromEntries(MICRO_FIELDS.map((field) => [field, null])),
		vitamins: Object.fromEntries(VITAMIN_FIELDS.map((field) => [field, null])),
	};
}
const NUTRIENT_DECIMAL_THRESHOLD = 100;
const NUTRIENT_NUMBER_FORMAT = new Intl.NumberFormat();
const OPENAI_ALLOWED_MODELS = Object.freeze([
	"gpt-5.5",
	"gpt-5.4",
	"gpt-5.4-mini",
]);
const DEFAULT_OPENAI_MODEL = "gpt-5.4-mini";
const OPENAI_EXTRACTION_MODEL = "gpt-5.4-mini";
const SUPPORTED_LLM_PROVIDERS = new Set(["openai", "byo"]);
const DEFAULT_LLM_PROVIDER = "openai";
const OPENAI_REASONING_EFFORTS = new Set(["none", "low", "medium", "high"]);
const OPENAI_MAX_TOKENS_WITH_REASONING = 4096;
const OPENAI_MAX_TOKENS_STANDARD = 320;
const Z_INDEX_OVERLAY_PORTAL = 11000;
const MAX_IMPERIAL_HEIGHT_PART = 11;
const VALID_CALORIE_GOALS = new Set(["lose", "maintain", "gain"]);
const defaultState = {
	settings: {
		defaultFastTypeId: "16_8",
		notifyOnEnd: true,
		hourlyReminders: true,
		alertsEnabled: false,
		showRingEmojis: true,
		timeDisplayMode: "elapsed",
		llmProvider: DEFAULT_LLM_PROVIDER,
		openaiApiKey: "",
		openaiModel: DEFAULT_OPENAI_MODEL,
		openaiReasoningEffort: "low",
		openaiTrainerInstructions: "",
		openaiNotesRange: 0,
		byoLlm: {
			apiUrl: "",
			apiKey: "",
			model: "",
			reasoningEffort: "none",
			maxCompletionTokens: OPENAI_MAX_TOKENS_WITH_REASONING,
			temperature: 1,
			headersJson: "",
			trainerInstructions: "",
			notesRange: 0,
		},
		calories: {
			dailyTarget: null,
			goal: "",
			age: null,
			height: null,
			currentWeight: null,
			gender: "",
			fitnessLevel: "",
			unitSystem: "imperial",
			target: null,
			consumed: 0,
			view: "total",
			nutrientGoals: buildDefaultNutrientGoals(),
		},
		theme: {
			presetId: DEFAULT_THEME_ID,
			customColors: { ...DEFAULT_THEME_COLORS },
		},
	},
	activeFast: null,
	history: [],
	reminders: { endNotified: false, lastHourlyAt: null },
	milestoneTally: {},
};

const firebaseConfig = window.FIREBASE_CONFIG;
if (
	!firebaseConfig?.apiKey ||
	!firebaseConfig?.authDomain ||
	!firebaseConfig?.projectId ||
	!firebaseConfig?.appId
) {
	throw new Error("Missing Firebase configuration. Check firebase-config.js.");
}

const firebaseApp = initializeApp(firebaseConfig);
const _analytics = firebaseConfig?.measurementId
	? getAnalytics(firebaseApp)
	: null;
const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);

let state = clone(defaultState);
let selectedFastTypeId = defaultState.settings.defaultFastTypeId;
let pendingTypeId = null;
let calendarMonth = startOfMonth(new Date());
let selectedDayKey = formatDateKey(new Date());
let tickHandle = null;
let toastHandle = null;
let swReg = null;
let appInitialized = false;
let authMode = "sign-in";
let cryptoKey = null;
let keySalt = null;
let pendingPassword = null;
let needsUnlock = false;
let authRememberChoice = null;
let stateUnsubscribe = null;
let notesUnsubscribe = null;
let notesDrawerCloseTimeout = null;
let notesLoaded = false;
let notes = [];
let noteEditorCloseTimeout = null;
let editingNoteId = null;
let openAIModelOptions = [];
let openAIModelsLoadedForKey = "";
let reasoningSupportToastShown = false;
let editingNoteDateKey = null;
let editingNoteContext = null;
let editingNoteCreatedAt = null;
let editingNoteOpenedAt = null;
let editingNoteInitialText = "";
let editingNoteInitialCalories = "";
let editingNoteInitialNutrition = "";
let editingNoteInitialTrainerResponse = "";
let editingNoteMetadata = null;
let editingNoteReadOnly = false;
let noteEditorTrainerConversationAbortController = null;
let editingHistoryId = null;

let navHoldTimer = null;
let navHoldShown = false;
let suppressNavClickEl = null;

// Notes overlay state (opens above other tabs)
let currentTab = "timer";
let _lastNonNotesTab = "timer";
let ringEmojiTypeId = null;
let ringEmojiSelectionKey = null;
let ringEmojiSelectionDetail = null;
let ringEmojiLayoutSize = 0;
let calorieTipGoalId = null;
let calorieTipSelectionKey = null;
let calorieTipLayoutSize = 0;
let notesOverlayOpen = false;
let notesPortal = null;
let notesBackdrop = null;
let bodyOverflowBeforeNotes = null;
let notesSwipeHandlersAttached = false;
let aiTrainerNotesRangeOverride = null;
let aiTrainerProviderOverride = null;
let aiTrainerNoteFilterOverride = [];
let aiTrainerNoteAbortController = null;
let quickTrainerQuestionAbortController = null;
let historyProgressOverlayOpen = false;
let historyProgressPortal = null;
let historyProgressDrawerCloseTimeout = null;
let historyNotesOverlayOpen = false;
let historyNotesPortal = null;
let historyNotesDrawerCloseTimeout = null;
let recentFastsOverlayOpen = false;
let recentFastsPortal = null;
let recentFastsDrawerCloseTimeout = null;
let nutritionProgressOverlayOpen = false;
let nutritionProgressPortal = null;
let nutritionProgressDrawerCloseTimeout = null;
let calorieTargetOverlayOpen = false;
let calorieTargetPortal = null;
let calorieTargetDrawerCloseTimeout = null;
let calorieGoalOverlayOpen = false;
let calorieGoalPortal = null;
let calorieGoalDrawerCloseTimeout = null;
let settingsOverlayOpen = false;
let settingsPortal = null;
let settingsDrawerCloseTimeout = null;
let bodyOverflowBeforeSecondaryDrawers = null;
let secondaryDrawerEscapeHandlerAttached = false;
let noteEditorSwipeHandlersAttached = false;
let pendingConfirmAction = null;
let pendingConfirmCloseFocus = null;
let pendingPostFastNote = null;

document.addEventListener("DOMContentLoaded", () => {
	void initApp();
});

function $(id) {
	return document.getElementById(id);
}
function clone(x) {
	return JSON.parse(JSON.stringify(x));
}

async function initApp() {
	try {
		const themeData = await loadThemePresets();
		THEME_PRESET_LIST = themeData.list;
		THEME_PRESETS = themeData.map;
		syncThemeDefaults();
	} catch (err) {
		console.error("Failed to load theme presets:", err);
		THEME_PRESET_LIST = [
			{
				id: DEFAULT_THEME_ID,
				label: "Midnight",
				colors: { ...DEFAULT_THEME_COLORS },
			},
		];
		THEME_PRESETS = {
			[DEFAULT_THEME_ID]: {
				label: "Midnight",
				colors: { ...DEFAULT_THEME_COLORS },
			},
		};
		syncThemeDefaults();
	}

	try {
		FASTING_HOURLY = await loadFastingHourly();
	} catch (err) {
		console.error("Failed to load fasting-hourly.yaml:", err);
		FASTING_HOURLY = { hours: [], notes: [] };
	}

	try {
		FAST_TYPES = await loadFastTypes();
	} catch (err) {
		console.error("Failed to load fast types:", err);
		FAST_TYPES = [];
	}

	try {
		CALORIE_TIPS = await loadCalorieTips();
	} catch (err) {
		console.error("Failed to load calorie-tips.yaml:", err);
		CALORIE_TIPS = { goals: [], map: {} };
	}

	if (!Array.isArray(FAST_TYPES) || FAST_TYPES.length === 0) {
		FAST_TYPES = [
			{
				id: defaultState.settings.defaultFastTypeId,
				label: "16:8",
				durationHours: 16,
				milestoneHours: [],
			},
		];
	}

	FAST_TYPES = hydrateFastTypes(FAST_TYPES, FASTING_HOURLY);

	selectedFastTypeId = resolveFastTypeId(selectedFastTypeId);
	initAuthUI();
	initAuthListener();
}

async function loadThemePresets() {
	const response = await fetch("./themes.yaml", { cache: "no-store" });
	if (!response.ok)
		throw new Error(`themes.yaml request failed (${response.status})`);
	const text = await response.text();
	const data = loadYaml(text);
	if (!Array.isArray(data)) throw new Error("themes.yaml is not a list");
	const list = data
		.filter((theme) => theme?.id && theme?.colors)
		.map((theme) => ({
			id: String(theme.id),
			label: theme.label || String(theme.id),
			colors: theme.colors,
		}));
	if (list.length === 0) throw new Error("themes.yaml has no presets");
	const map = list.reduce((acc, theme) => {
		acc[theme.id] = { label: theme.label, colors: theme.colors };
		return acc;
	}, {});
	return { list, map };
}

function syncThemeDefaults() {
	const fallbackPreset =
		THEME_PRESET_LIST.find((theme) => theme.id === DEFAULT_THEME_ID) ||
		THEME_PRESET_LIST[0];
	if (!fallbackPreset) return;
	defaultState.settings.theme.presetId = fallbackPreset.id;
	defaultState.settings.theme.customColors = { ...fallbackPreset.colors };
	if (state?.settings?.theme?.presetId === fallbackPreset.id) {
		state.settings.theme.customColors = { ...fallbackPreset.colors };
	}
}

async function loadFastTypes() {
	const response = await fetch("./fast-types.yaml", { cache: "no-store" });
	if (!response.ok)
		throw new Error(`fast-types.yaml request failed (${response.status})`);
	const text = await response.text();
	const data = loadYaml(text);
	if (!Array.isArray(data)) throw new Error("fast-types.yaml is not a list");
	return data;
}

async function loadFastingHourly() {
	const response = await fetch("./fasting-hourly.yaml", { cache: "no-store" });
	if (!response.ok)
		throw new Error(`fasting-hourly.yaml request failed (${response.status})`);
	const text = await response.text();
	const data = loadYaml(text);
	return normalizeFastingHourly(data);
}

async function loadCalorieTips() {
	const response = await fetch("./calorie-tips.yaml", { cache: "no-store" });
	if (!response.ok)
		throw new Error(`calorie-tips.yaml request failed (${response.status})`);
	const text = await response.text();
	const data = loadYaml(text);
	return normalizeCalorieTips(data);
}

function normalizeFastingHourly(data) {
	const hours = Array.isArray(data?.hours)
		? data.hours
		: Array.isArray(data)
			? data
			: [];
	const notes = Array.isArray(data?.notes)
		? data.notes.filter((note) => typeof note === "string")
		: [];
	const normalizedHours = hours
		.filter((entry) => entry && Number.isFinite(Number(entry.hour)))
		.map((entry) => ({
			hour: Number(entry.hour),
			emoji: typeof entry.emoji === "string" ? entry.emoji : "\u23f3",
			label:
				typeof entry.label === "string" ? entry.label : `Hour ${entry.hour}`,
			actions: Array.isArray(entry.actions)
				? entry.actions.filter((action) => typeof action === "string")
				: [],
		}))
		.sort((a, b) => a.hour - b.hour);
	return { hours: normalizedHours, notes };
}

function normalizeCalorieTips(data) {
	const goals = Array.isArray(data?.goals)
		? data.goals
		: Array.isArray(data)
			? data
			: [];
	const normalizedGoals = goals
		.map((goal) => {
			const id = typeof goal?.id === "string" ? goal.id.trim() : "";
			if (!id) return null;
			const tips = Array.isArray(goal?.tips)
				? goal.tips
						.filter((tip) => tip && typeof tip === "object")
						.map((tip) => ({
							emoji: typeof tip.emoji === "string" ? tip.emoji : "\u2728",
							title: typeof tip.title === "string" ? tip.title : "Quick tip",
							detail: typeof tip.detail === "string" ? tip.detail : "",
						}))
						.filter((tip) => tip.title || tip.detail)
				: [];
			return {
				id,
				label: typeof goal?.label === "string" ? goal.label : id,
				tips,
			};
		})
		.filter(Boolean);
	const map = normalizedGoals.reduce((acc, goal) => {
		acc[goal.id] = goal;
		return acc;
	}, {});
	return { goals: normalizedGoals, map };
}

function hydrateFastTypes(types, hourly) {
	if (!Array.isArray(types)) return [];
	return types.map((type) => {
		const milestoneHours = Array.isArray(type.milestoneHours)
			? type.milestoneHours
			: [];
		const milestones = buildMilestones(milestoneHours, hourly);
		return { ...type, milestoneHours, milestones };
	});
}

function getHourlyEntry(hour) {
	const numericHour = Number(hour);
	return FASTING_HOURLY.hours.find((entry) => entry.hour === numericHour);
}

function formatHourlyAction(hour, action) {
	return `${hour}h after eating: ${action}`;
}

function getHourlyActionDetail(hour, { random = false } = {}) {
	const entry = getHourlyEntry(hour);
	if (!entry) return null;
	const actions = Array.isArray(entry.actions) ? entry.actions : [];
	const action =
		random && actions.length
			? actions[Math.floor(Math.random() * actions.length)]
			: actions[0];
	if (!action) return null;
	return formatHourlyAction(entry.hour, action);
}

function buildMilestones(hours, hourly) {
	if (!Array.isArray(hours)) return [];
	return hours
		.map((hour) => {
			const entry = hourly.hours.find((item) => item.hour === Number(hour));
			if (!entry) return null;
			const baseAction = Array.isArray(entry.actions) ? entry.actions[0] : null;
			const detail = baseAction
				? formatHourlyAction(entry.hour, baseAction)
				: `Hour ${entry.hour}`;
			return {
				hour: entry.hour,
				emoji: entry.emoji,
				label: entry.label,
				detail,
			};
		})
		.filter(Boolean);
}

function resolveFastTypeId(typeId) {
	if (!Array.isArray(FAST_TYPES) || FAST_TYPES.length === 0) {
		return defaultState.settings.defaultFastTypeId;
	}
	const found = FAST_TYPES.find((type) => type.id === typeId);
	return found ? found.id : FAST_TYPES[0].id;
}

function decodeBase64(base64) {
	const binary = atob(base64);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) {
		bytes[i] = binary.charCodeAt(i);
	}
	return bytes;
}

function encodeBase64(bytes) {
	let binary = "";
	bytes.forEach((b) => {
		binary += String.fromCharCode(b);
	});
	return btoa(binary);
}

function getStateDocRef(uid) {
	return doc(db, "users", uid, "fastingState", "state");
}

function getUserDocRef(uid) {
	return doc(db, "users", uid);
}

function getNotesCollectionRef(uid) {
	return collection(db, "users", uid, "notes");
}

function getNoteDocRef(uid, noteId) {
	return doc(db, "users", uid, "notes", noteId);
}

function stopNotesListener() {
	if (notesUnsubscribe) {
		notesUnsubscribe();
		notesUnsubscribe = null;
	}
}

async function normalizeNoteSnapshot(snap) {
	const data = snap.data() || {};
	let text = "";
	let calorieEntry = null;
	let trainerResponse = "";
	if (data?.payload?.iv && data?.payload?.ciphertext) {
		try {
			const decrypted = await decryptNotePayload(data.payload);
			if (typeof decrypted === "string") {
				text = decrypted;
			} else if (decrypted && typeof decrypted === "object") {
				if (typeof decrypted.text === "string") text = decrypted.text;
				calorieEntry = normalizeCalorieEntry(decrypted.calorieEntry);
				if (typeof decrypted.trainerResponse === "string") {
					trainerResponse = decrypted.trainerResponse;
				}
			}
		} catch (err) {
			if (err?.message === "missing-key") throw err;
			throw new Error("decrypt-failed");
		}
	} else if (typeof data.text === "string") {
		text = data.text;
	}
	if (!trainerResponse && typeof data.trainerResponse === "string") {
		trainerResponse = data.trainerResponse;
	}
	if (!calorieEntry) calorieEntry = normalizeCalorieEntry(data.calorieEntry);
	if (!text && calorieEntry?.foodNote) {
		text = calorieEntry.foodNote;
	}
	const normalizedCreatedAt =
		typeof data.createdAt === "number" ? data.createdAt : 0;
	return {
		id: snap.id,
		text,
		createdAt: normalizedCreatedAt,
		updatedAt: typeof data.updatedAt === "number" ? data.updatedAt : 0,
		dateKey: typeof data.dateKey === "string" ? data.dateKey : "",
		goalContext: normalizeGoalContext(data.goalContext),
		fastContext: normalizeFastContext(data.fastContext, normalizedCreatedAt),
		metadata: normalizeNoteMetadata(data.metadata, text),
		calorieEntry,
		trainerResponse,
	};
}

function normalizeGoalMetric(value) {
	const num = Number(value);
	if (!Number.isFinite(num) || num < 0) return null;
	return num;
}

function normalizeNutrientGoalSettings(nutrientGoals) {
	return {
		macros: normalizeNutrientGroup(nutrientGoals?.macros, MACRO_FIELDS),
		micros: normalizeNutrientGroup(nutrientGoals?.micros, MICRO_FIELDS),
		vitamins: normalizeNutrientGroup(nutrientGoals?.vitamins, VITAMIN_FIELDS),
	};
}

function normalizeGoalContext(goalContext) {
	if (!goalContext || typeof goalContext !== "object") {
		return {
			dailyTarget: null,
			goal: "",
			age: null,
			height: null,
			currentWeight: null,
			gender: "",
			fitnessLevel: "",
			nutrientGoals: buildDefaultNutrientGoals(),
		};
	}

	const dailyTarget = normalizeGoalMetric(goalContext.dailyTarget);
	const legacyWeight = normalizeGoalMetric(goalContext.bmi);
	return {
		dailyTarget: dailyTarget && dailyTarget > 0 ? dailyTarget : null,
		goal: typeof goalContext.goal === "string" ? goalContext.goal : "",
		age: normalizeGoalMetric(goalContext.age),
		height: normalizeGoalMetric(goalContext.height),
		currentWeight:
			normalizeGoalMetric(goalContext.currentWeight) ?? legacyWeight,
		gender: typeof goalContext.gender === "string" ? goalContext.gender : "",
		fitnessLevel:
			typeof goalContext.fitnessLevel === "string"
				? goalContext.fitnessLevel
				: "",
		nutrientGoals: normalizeNutrientGoalSettings(goalContext.nutrientGoals),
	};
}

function normalizeCalorieEntry(entry) {
	if (!entry || typeof entry !== "object") return null;
	const calories = Number(entry.calories);
	const normalizedCalories =
		Number.isFinite(calories) && calories >= 0 ? calories : null;
	const foodNote = typeof entry.foodNote === "string" ? entry.foodNote : "";
	const macros = normalizeNutrientGroup(entry.macros, MACRO_FIELDS);
	const micros = normalizeNutrientGroup(entry.micros, MICRO_FIELDS);
	const vitamins = normalizeNutrientGroup(entry.vitamins, VITAMIN_FIELDS);
	const goalSnapshot = entry.goalSnapshot
		? normalizeGoalContext(entry.goalSnapshot)
		: null;
	const hasNutrientValue = hasAnyNutrientValue(macros, micros, vitamins);
	if (normalizedCalories === null && !foodNote && !hasNutrientValue)
		return null;
	return {
		calories: normalizedCalories,
		foodNote,
		macros,
		micros,
		vitamins,
		goalSnapshot,
	};
}

function normalizeNutrientGroup(group, fields) {
	return fields.reduce((acc, field) => {
		const value = Number(group?.[field]);
		acc[field] = Number.isFinite(value) && value >= 0 ? value : null;
		return acc;
	}, {});
}

function hasAnyNutrientValue(
	macros = {},
	micros = {},
	vitaminsOrOptions = {},
	maybeOptions = {},
) {
	const legacyOptions =
		vitaminsOrOptions && typeof vitaminsOrOptions === "object"
			? vitaminsOrOptions
			: null;
	const usingLegacyOptionsArg =
		legacyOptions &&
		Object.hasOwn(legacyOptions, "positiveOnly") &&
		(!maybeOptions || Object.keys(maybeOptions).length === 0);
	const vitamins = usingLegacyOptionsArg ? {} : vitaminsOrOptions;
	const options = usingLegacyOptionsArg ? legacyOptions : maybeOptions;
	const { positiveOnly = false } = options || {};
	return [
		...Object.values(macros),
		...Object.values(micros),
		...Object.values(vitamins),
	].some((value) => Number.isFinite(value) && (!positiveOnly || value > 0));
}

function normalizeFastContext(fastContext, createdAt) {
	if (!fastContext || typeof fastContext !== "object")
		return buildInactiveFastContext();

	const legacyTypeId =
		typeof fastContext.typeId === "string" ? fastContext.typeId : null;
	const legacyTypeLabel =
		typeof fastContext.typeLabel === "string" ? fastContext.typeLabel : null;
	const legacyDuration =
		typeof fastContext.durationHours === "number"
			? fastContext.durationHours
			: null;
	const wasActive =
		typeof fastContext.wasActive === "boolean"
			? fastContext.wasActive
			: Boolean(fastContext.fastId || legacyTypeId || legacyTypeLabel);
	const normalizedCreatedAt = typeof createdAt === "number" ? createdAt : null;
	const startTimestamp = fastContext.startTimestamp ?? null;
	const elapsedMsAtNote =
		typeof fastContext.elapsedMsAtNote === "number"
			? fastContext.elapsedMsAtNote
			: typeof startTimestamp === "number" &&
					typeof normalizedCreatedAt === "number"
				? Math.max(0, normalizedCreatedAt - startTimestamp)
				: null;

	return {
		wasActive,
		fastId: fastContext.fastId ?? null,
		fastTypeId: fastContext.fastTypeId ?? legacyTypeId,
		fastTypeLabel: fastContext.fastTypeLabel ?? legacyTypeLabel,
		startTimestamp,
		plannedDurationHours: fastContext.plannedDurationHours ?? legacyDuration,
		elapsedMsAtNote,
	};
}

function normalizeNoteTags(tags) {
	if (!Array.isArray(tags)) return [];
	return [
		...new Set(tags.map((tag) => String(tag || "").trim()).filter(Boolean)),
	];
}

function normalizeNoteMetadata(metadata, text = "") {
	const raw = metadata && typeof metadata === "object" ? metadata : {};
	const source = String(raw.source || "").trim();
	const marker = String(raw.marker || "").trim();
	const noteText = String(text || "").trim();
	const legacyAITrainerNote =
		noteText.startsWith(AI_TRAINER_NOTE_TITLE) ||
		noteText.startsWith(AI_TRAINER_NOTE_HEADING);
	const isAITrainer =
		source === AI_TRAINER_NOTE_SOURCE ||
		marker === AI_TRAINER_NOTE_MARKER ||
		raw.type === "trainer_note" ||
		raw.isAINote === true ||
		legacyAITrainerNote;

	if (isAITrainer) {
		return {
			source: AI_TRAINER_NOTE_SOURCE,
			type: "trainer_note",
			isAINote: true,
			readOnly: true,
			contentFormat: "markdown",
			marker: AI_TRAINER_NOTE_MARKER,
			tags: [...AI_TRAINER_NOTE_TAGS],
		};
	}

	return {
		source: source || "user",
		type:
			typeof raw.type === "string" && raw.type.trim()
				? raw.type.trim()
				: "journal",
		isAINote: raw.isAINote === true,
		readOnly: raw.readOnly === true,
		contentFormat: raw.contentFormat === "markdown" ? "markdown" : "plain",
		marker: marker || null,
		tags: normalizeNoteTags(raw.tags),
	};
}

function isAITrainerNote(note) {
	return (
		normalizeNoteMetadata(note?.metadata, note?.text).source ===
		AI_TRAINER_NOTE_SOURCE
	);
}

function isReadOnlyNote(note) {
	const metadata = normalizeNoteMetadata(note?.metadata, note?.text);
	return (
		metadata.readOnly === true || metadata.source === AI_TRAINER_NOTE_SOURCE
	);
}

function getDisplayNoteText(note) {
	const text = String(note?.text || "");
	if (!isAITrainerNote(note)) return text;
	const trimmed = text.trim();
	const title = trimmed.startsWith(AI_TRAINER_NOTE_HEADING)
		? AI_TRAINER_NOTE_HEADING
		: trimmed.startsWith(AI_TRAINER_NOTE_TITLE)
			? AI_TRAINER_NOTE_TITLE
			: "";
	if (!title) return text;
	return trimmed
		.slice(title.length)
		.replace(/^\s*-{3,}\s*/u, "")
		.replace(/^\s+/, "");
}

function buildInactiveFastContext() {
	return {
		wasActive: false,
		fastId: null,
		fastTypeId: null,
		fastTypeLabel: null,
		startTimestamp: null,
		plannedDurationHours: null,
		elapsedMsAtNote: null,
	};
}

function buildFastContextAt(timestampMs) {
	if (!state.activeFast) return buildInactiveFastContext();
	const type = getTypeById(state.activeFast.typeId);
	const elapsedMsAtNote =
		typeof state.activeFast.startTimestamp === "number"
			? Math.max(
					0,
					(timestampMs ?? Date.now()) - state.activeFast.startTimestamp,
				)
			: null;
	return {
		wasActive: true,
		fastId: state.activeFast.id,
		fastTypeId: state.activeFast.typeId,
		fastTypeLabel: type?.label || null,
		startTimestamp: state.activeFast.startTimestamp,
		plannedDurationHours: state.activeFast.plannedDurationHours,
		elapsedMsAtNote,
	};
}

function buildFastContextFromFast(fast, timestampMs) {
	if (!fast) return buildInactiveFastContext();
	const type = getTypeById(fast.typeId);
	const elapsedMsAtNote =
		typeof fast.startTimestamp === "number"
			? Math.max(0, (timestampMs ?? Date.now()) - fast.startTimestamp)
			: null;
	return {
		wasActive: true,
		fastId: fast.id,
		fastTypeId: fast.typeId,
		fastTypeLabel: type?.label || null,
		startTimestamp: fast.startTimestamp,
		plannedDurationHours: fast.plannedDurationHours,
		elapsedMsAtNote,
	};
}

function buildFastContext() {
	return buildFastContextAt(Date.now());
}

function buildGoalContext() {
	const settings = getCalorieSettings();
	const dailyTarget = getCalorieTarget();
	return {
		dailyTarget,
		goal: typeof settings.goal === "string" ? settings.goal : "",
		age: normalizeGoalMetric(settings.age),
		height: normalizeGoalMetric(settings.height),
		currentWeight: normalizeGoalMetric(settings.currentWeight),
		gender: typeof settings.gender === "string" ? settings.gender : "",
		fitnessLevel:
			typeof settings.fitnessLevel === "string" ? settings.fitnessLevel : "",
		nutrientGoals: normalizeNutrientGoalSettings(settings.nutrientGoals),
	};
}

async function buildNotePayload({
	text,
	dateKey,
	fastContext,
	goalContext,
	calorieEntry,
	trainerResponse,
	metadata,
} = {}) {
	const createdAt = Date.now();
	const noteText = (text || "").trim();
	const payload = await encryptNotePayload({
		text: noteText,
		calorieEntry: calorieEntry ?? null,
		trainerResponse:
			typeof trainerResponse === "string" ? trainerResponse.trim() : "",
	});
	return {
		payload,
		createdAt,
		updatedAt: createdAt,
		dateKey:
			typeof dateKey === "string"
				? dateKey
				: formatDateKey(new Date(createdAt)),
		goalContext: goalContext ?? buildGoalContext(),
		fastContext: fastContext ?? buildFastContextAt(createdAt),
		metadata: normalizeNoteMetadata(metadata, noteText),
	};
}

async function buildNoteUpdatePayload({
	text,
	dateKey,
	fastContext,
	createdAt,
	goalContext,
	calorieEntry,
	trainerResponse,
	metadata,
} = {}) {
	const payload = { updatedAt: Date.now() };
	if (
		typeof text === "string" ||
		calorieEntry !== undefined ||
		typeof trainerResponse === "string"
	) {
		payload.payload = await encryptNotePayload({
			text: typeof text === "string" ? text.trim() : "",
			calorieEntry: calorieEntry ?? null,
			trainerResponse:
				typeof trainerResponse === "string" ? trainerResponse.trim() : "",
		});
	}
	if (typeof dateKey === "string") payload.dateKey = dateKey;
	if (fastContext !== undefined) {
		if (fastContext === null || typeof fastContext !== "object") {
			payload.fastContext = fastContext;
		} else {
			const fields = [
				["wasActive", fastContext.wasActive],
				["fastId", fastContext.fastId],
				["fastTypeId", fastContext.fastTypeId],
				["fastTypeLabel", fastContext.fastTypeLabel],
				["startTimestamp", fastContext.startTimestamp],
				["plannedDurationHours", fastContext.plannedDurationHours],
			];
			fields.forEach(([key, value]) => {
				if (value !== undefined) payload[`fastContext.${key}`] = value;
			});
			if (Object.hasOwn(fastContext, "elapsedMsAtNote")) {
				payload["fastContext.elapsedMsAtNote"] =
					fastContext.elapsedMsAtNote ?? null;
			}
		}
	}
	const resolvedGoalContext =
		goalContext === undefined ? buildGoalContext() : goalContext;
	if (resolvedGoalContext !== undefined) {
		if (
			resolvedGoalContext === null ||
			typeof resolvedGoalContext !== "object"
		) {
			payload.goalContext = resolvedGoalContext;
		} else {
			const fields = [
				["dailyTarget", resolvedGoalContext.dailyTarget],
				["goal", resolvedGoalContext.goal],
				["age", resolvedGoalContext.age],
				["height", resolvedGoalContext.height],
				["currentWeight", resolvedGoalContext.currentWeight],
				["gender", resolvedGoalContext.gender],
				["fitnessLevel", resolvedGoalContext.fitnessLevel],
				[
					"nutrientGoals",
					normalizeNutrientGoalSettings(resolvedGoalContext.nutrientGoals),
				],
			];
			fields.forEach(([key, value]) => {
				if (value !== undefined) payload[`goalContext.${key}`] = value;
			});
		}
	}
	if (typeof createdAt === "number") payload.createdAt = createdAt;
	if (metadata !== undefined) {
		payload.metadata = normalizeNoteMetadata(
			metadata,
			typeof text === "string" ? text : "",
		);
	}
	return payload;
}

async function createNote({
	text,
	dateKey,
	fastContext,
	calorieEntry,
	trainerResponse,
	metadata,
} = {}) {
	const user = auth.currentUser;
	if (!user) return null;
	const payload = await buildNotePayload({
		text,
		dateKey,
		fastContext,
		calorieEntry,
		trainerResponse,
		metadata,
	});
	try {
		const docRef = await addDoc(getNotesCollectionRef(user.uid), payload);
		return docRef.id;
	} catch {
		return null;
	}
}

async function updateNote(
	noteId,
	{
		text,
		dateKey,
		fastContext,
		createdAt,
		calorieEntry,
		trainerResponse,
		metadata,
	} = {},
) {
	const user = auth.currentUser;
	if (!user || !noteId) return;
	const payload = await buildNoteUpdatePayload({
		text,
		dateKey,
		fastContext,
		createdAt,
		calorieEntry,
		trainerResponse,
		metadata,
	});
	try {
		await setDoc(getNoteDocRef(user.uid, noteId), payload, { merge: true });
	} catch {}
}

async function deleteNote(noteId) {
	const user = auth.currentUser;
	if (!user || !noteId) return;
	try {
		await deleteDoc(getNoteDocRef(user.uid, noteId));
	} catch {}
}

function openNoteEditor(note = null) {
	const modal = $("note-editor-modal");
	if (!modal) return;
	if (noteEditorCloseTimeout) {
		clearTimeout(noteEditorCloseTimeout);
		noteEditorCloseTimeout = null;
	}
	editingNoteId = note?.id || null;
	editingNoteDateKey = note?.dateKey || formatDateKey(new Date());
	editingNoteContext = note?.fastContext ?? buildFastContext();
	editingNoteCreatedAt = note?.createdAt ?? null;
	editingNoteOpenedAt = Date.now();

	const noteText = getDisplayNoteText(note);
	editingNoteMetadata = normalizeNoteMetadata(note?.metadata, note?.text || "");
	editingNoteReadOnly = isReadOnlyNote(note);
	$("note-editor-content").value = noteText || "";
	const trainerResponseInput = $("note-editor-trainer-response");
	const isTrainerNote = editingNoteMetadata?.source === AI_TRAINER_NOTE_SOURCE;
	if (trainerResponseInput) {
		trainerResponseInput.value = isTrainerNote
			? ""
			: note?.trainerResponse || "";
	}
	$("note-editor-calories").value = Number.isFinite(
		note?.calorieEntry?.calories,
	)
		? note.calorieEntry.calories
		: "";
	setNoteEditorNutritionFields(note?.calorieEntry);
	editingNoteInitialText = $("note-editor-content").value.trim();
	editingNoteInitialCalories = $("note-editor-calories").value.trim();
	editingNoteInitialNutrition = serializeNoteEditorNutritionFields();
	editingNoteInitialTrainerResponse = trainerResponseInput?.value.trim() || "";
	updateNoteEditorMeta();
	renderNoteEditorTrainerConversation();
	$("note-editor-delete").classList.toggle("hidden", !editingNoteId);
	applyNoteEditorReadOnlyState(editingNoteReadOnly);
	modal.classList.remove("hidden");
	requestAnimationFrame(() => modal.classList.add("is-open"));
}

function parseCalorieInput(value) {
	if (value === "") return null;
	const parsed = Number(value);
	if (!Number.isFinite(parsed) || parsed < 0) return null;
	return parsed;
}

function setNoteEditorNutritionFields(entry) {
	NOTE_EDITOR_NUTRIENT_FIELDS.forEach(({ id, group, key }) => {
		const input = $(id);
		if (!input) return;
		const value = entry?.[group]?.[key];
		input.value = Number.isFinite(value) ? String(value) : "";
	});
}

function serializeNoteEditorNutritionFields() {
	return NOTE_EDITOR_NUTRIENT_FIELDS.map(
		({ id }) => `${id}:${$(id)?.value?.trim() || ""}`,
	).join("|");
}

function applyNoteEditorReadOnlyState(readOnly) {
	const modal = $("note-editor-modal");
	if (modal) modal.classList.toggle("is-read-only", Boolean(readOnly));
	const isTrainerNote = editingNoteMetadata?.source === AI_TRAINER_NOTE_SOURCE;
	const content = $("note-editor-content");
	if (content) content.readOnly = Boolean(readOnly);
	const markdownPreview = $("note-editor-markdown-preview");
	const showMarkdownPreview =
		Boolean(readOnly) && editingNoteMetadata?.contentFormat === "markdown";
	if (markdownPreview) {
		markdownPreview.innerHTML = showMarkdownPreview
			? renderMarkdownToHtml(content?.value || "")
			: "";
		markdownPreview.classList.toggle("hidden", !showMarkdownPreview);
	}
	if (content) content.classList.toggle("hidden", showMarkdownPreview);
	[
		"note-editor-calories",
		...NOTE_EDITOR_NUTRIENT_FIELDS.map(({ id }) => id),
	].forEach((id) => {
		const input = $(id);
		if (input) input.readOnly = Boolean(readOnly);
	});
	const estimateButton = $("note-editor-ai-estimate");
	if (estimateButton) estimateButton.disabled = Boolean(readOnly);
	const responseWrap = $("note-editor-trainer-response-wrap");
	if (responseWrap) {
		responseWrap.classList.toggle("hidden", !isTrainerNote);
	}
	const nutritionWrap = $("note-editor-nutrition-wrap");
	if (nutritionWrap) {
		nutritionWrap.classList.toggle("hidden", isTrainerNote);
	}
	const responseInput = $("note-editor-trainer-response");
	if (responseInput) responseInput.readOnly = !isTrainerNote;
	const trainerActions = $("note-editor-trainer-actions");
	if (trainerActions) trainerActions.classList.toggle("hidden", !isTrainerNote);
	const saveButton = $("note-editor-save");
	if (saveButton) {
		saveButton.classList.toggle("hidden", Boolean(readOnly) || isTrainerNote);
		saveButton.textContent = "Save note";
	}
	const readOnlyNotice = $("note-editor-readonly");
	if (readOnlyNotice) {
		readOnlyNotice.textContent = isTrainerNote
			? "Core trainer note is read-only · Continue the chat below."
			: "AI trainer note · read-only";
		readOnlyNotice.classList.toggle("hidden", !readOnly);
	}
	renderNoteEditorTrainerConversation();
}

function hasNoteEditorNutritionContent() {
	return NOTE_EDITOR_NUTRIENT_FIELDS.some(({ id }) =>
		Boolean($(id)?.value?.trim()),
	);
}

function buildCalorieEntryFromEditor() {
	const noteContent = $("note-editor-content")?.value.trim() || "";
	const calories = parseCalorieInput($("note-editor-calories").value.trim());
	const macros = {
		protein: parseCalorieInput($("note-editor-protein")?.value.trim() || ""),
		carbs: parseCalorieInput($("note-editor-carbs")?.value.trim() || ""),
		fat: parseCalorieInput($("note-editor-fat")?.value.trim() || ""),
	};
	const micros = {
		sodium: parseCalorieInput($("note-editor-sodium")?.value.trim() || ""),
		potassium: parseCalorieInput(
			$("note-editor-potassium")?.value.trim() || "",
		),
		calcium: parseCalorieInput($("note-editor-calcium")?.value.trim() || ""),
		iron: parseCalorieInput($("note-editor-iron")?.value.trim() || ""),
		magnesium: parseCalorieInput(
			$("note-editor-magnesium")?.value.trim() || "",
		),
		zinc: parseCalorieInput($("note-editor-zinc")?.value.trim() || ""),
	};
	const vitamins = {
		vitaminA: parseCalorieInput($("note-editor-vitamin-a")?.value.trim() || ""),
		vitaminC: parseCalorieInput($("note-editor-vitamin-c")?.value.trim() || ""),
		vitaminD: parseCalorieInput($("note-editor-vitamin-d")?.value.trim() || ""),
		vitaminB6: parseCalorieInput(
			$("note-editor-vitamin-b6")?.value.trim() || "",
		),
		vitaminB12: parseCalorieInput(
			$("note-editor-vitamin-b12")?.value.trim() || "",
		),
	};
	const hasNutrition = hasAnyNutrientValue(macros, micros, vitamins);
	if (calories === null && !hasNutrition) return null;
	return {
		calories,
		foodNote: noteContent,
		macros,
		micros,
		vitamins,
		goalSnapshot: buildGoalContext(),
	};
}

function isTouchDevice() {
	return navigator.maxTouchPoints > 0 || "ontouchstart" in window;
}

async function handleNoteEditorSwipeDismiss() {
	const modal = $("note-editor-modal");
	if (!modal || modal.classList.contains("hidden")) return;
	if (editingNoteMetadata?.source === AI_TRAINER_NOTE_SOURCE) {
		closeNoteEditor();
		return;
	}
	const text = $("note-editor-content").value.trim();
	const caloriesValue = $("note-editor-calories").value.trim();
	const nutritionValue = serializeNoteEditorNutritionFields();
	const trainerResponse = $("note-editor-trainer-response")?.value.trim() || "";
	const hasChanges =
		text !== editingNoteInitialText ||
		caloriesValue !== editingNoteInitialCalories ||
		nutritionValue !== editingNoteInitialNutrition ||
		trainerResponse !== editingNoteInitialTrainerResponse;
	const hasContent =
		Boolean(text) ||
		Boolean(caloriesValue) ||
		hasNoteEditorNutritionContent() ||
		Boolean(trainerResponse);
	if (hasChanges && hasContent) {
		const saved = await persistNoteEditor({ closeOnSave: false });
		if (!saved) return;
	}
	closeNoteEditor();
}

function attachNoteEditorSwipeHandlers() {
	if (noteEditorSwipeHandlersAttached || !isTouchDevice()) return;
	const panel = document.querySelector("#note-editor-modal .note-editor-panel");
	if (!panel) return;
	noteEditorSwipeHandlersAttached = true;

	let swipeStartX = 0;
	let swipeStartY = 0;

	panel.addEventListener(
		"touchstart",
		(event) => {
			if (!event.touches || event.touches.length !== 1) return;
			const touch = event.touches[0];
			swipeStartX = touch.clientX;
			swipeStartY = touch.clientY;
		},
		{ passive: true },
	);

	panel.addEventListener(
		"touchend",
		async (event) => {
			const touch = event.changedTouches?.[0];
			if (!touch) return;
			const deltaX = touch.clientX - swipeStartX;
			const deltaY = touch.clientY - swipeStartY;
			swipeStartX = 0;
			swipeStartY = 0;

			if (deltaX > 80 && Math.abs(deltaX) > Math.abs(deltaY)) {
				await handleNoteEditorSwipeDismiss();
			}
		},
		{ passive: true },
	);
}

function updateNoteEditorMeta() {
	const badge = $("note-editor-fast");
	const dateEl = $("note-editor-date");
	if (!badge || !dateEl) return;

	const dateObj = parseDateKey(editingNoteDateKey);
	const dateLabel = dateObj
		? dateObj.toLocaleDateString(undefined, {
				month: "short",
				day: "numeric",
				year: "numeric",
			})
		: "Unknown date";
	const createdLabel = editingNoteCreatedAt
		? `Created ${formatTimeShort(new Date(editingNoteCreatedAt))}`
		: null;
	const openedLabel = editingNoteOpenedAt
		? `Opened ${formatTimeShort(new Date(editingNoteOpenedAt))}`
		: null;
	const timeLabel = [createdLabel, openedLabel]
		.filter(Boolean)
		.join(UI_BULLET_SEPARATOR);
	dateEl.textContent = timeLabel
		? `${dateLabel}${UI_BULLET_SEPARATOR}${timeLabel}`
		: dateLabel;

	const isActive = Boolean(editingNoteContext?.wasActive);
	const elapsedMsAtNote = editingNoteContext?.elapsedMsAtNote;
	const hasElapsed = isActive && typeof elapsedMsAtNote === "number";
	if (editingNoteMetadata?.source === AI_TRAINER_NOTE_SOURCE) {
		badge.textContent = "AI trainer note";
		badge.classList.remove("is-muted");
		badge.classList.add("is-ai");
	} else if (isActive) {
		const typeLabel = editingNoteContext?.fastTypeLabel || "fast";
		const elapsedLabel = hasElapsed
			? `${UI_BULLET_SEPARATOR}${formatElapsedShort(elapsedMsAtNote)} in`
			: "";
		badge.textContent = `Active ${typeLabel}${elapsedLabel}`;
		badge.classList.remove("is-muted");
		badge.classList.remove("is-ai");
	} else {
		badge.textContent = "No active fast";
		badge.classList.add("is-muted");
		badge.classList.remove("is-ai");
	}
}

function closeNoteEditor() {
	const modal = $("note-editor-modal");
	if (!modal) return;
	modal.classList.remove("is-open");
	if (noteEditorCloseTimeout) clearTimeout(noteEditorCloseTimeout);
	noteEditorCloseTimeout = setTimeout(() => {
		modal.classList.add("hidden");
	}, 250);
	$("note-editor-content").value = "";
	const trainerResponseInput = $("note-editor-trainer-response");
	if (trainerResponseInput) trainerResponseInput.value = "";
	if (noteEditorTrainerConversationAbortController) {
		noteEditorTrainerConversationAbortController.abort();
		noteEditorTrainerConversationAbortController = null;
	}
	const trainerThread = $("note-editor-trainer-thread");
	if (trainerThread) trainerThread.innerHTML = "";
	const trainerCount = $("note-editor-trainer-count");
	if (trainerCount)
		trainerCount.textContent = `0 / ${TRAINER_NOTE_CONVERSATION_MAX_CHARS}`;
	$("note-editor-calories").value = "";
	setNoteEditorNutritionFields(null);
	editingNoteId = null;
	editingNoteDateKey = null;
	editingNoteContext = null;
	editingNoteCreatedAt = null;
	editingNoteOpenedAt = null;
	editingNoteInitialText = "";
	editingNoteInitialCalories = "";
	editingNoteInitialNutrition = "";
	editingNoteInitialTrainerResponse = "";
	editingNoteMetadata = null;
	editingNoteReadOnly = false;
	applyNoteEditorReadOnlyState(false);
}

async function persistNoteEditor({ closeOnSave = true } = {}) {
	const isTrainerNote = editingNoteMetadata?.source === AI_TRAINER_NOTE_SOURCE;
	const trainerResponse = $("note-editor-trainer-response")?.value.trim() || "";
	if (editingNoteReadOnly && isTrainerNote) {
		showToast("Use Send to trainer to continue this conversation");
		return false;
	}
	if (editingNoteReadOnly) {
		showToast("AI trainer notes are read-only");
		return false;
	}
	const text = $("note-editor-content").value.trim();
	const calorieEntry = buildCalorieEntryFromEditor();
	if (!text && !calorieEntry) {
		showToast("Add note content, calories, or nutrition values before saving");
		return false;
	}
	try {
		if (editingNoteId) {
			await updateNote(editingNoteId, {
				text,
				calorieEntry,
				dateKey: editingNoteDateKey,
				fastContext: editingNoteContext,
				createdAt: editingNoteCreatedAt,
				metadata: editingNoteMetadata,
				trainerResponse,
			});
		} else {
			await createNote({
				text,
				calorieEntry,
				dateKey: editingNoteDateKey,
				fastContext: editingNoteContext,
				metadata: editingNoteMetadata,
				trainerResponse,
			});
		}
	} catch (err) {
		if (err?.message === "missing-key") {
			handleNotesDecryptError(err);
			return false;
		}
	}
	renderNotes();
	if (closeOnSave) closeNoteEditor();
	return true;
}

async function saveNoteEditor() {
	await persistNoteEditor();
}

function getEditingNote() {
	if (!editingNoteId) return null;
	return notes.find((note) => note.id === editingNoteId) || null;
}

function renderNoteEditorTrainerConversation() {
	const wrap = $("note-editor-trainer-response-wrap");
	const thread = $("note-editor-trainer-thread");
	const input = $("note-editor-trainer-response");
	const count = $("note-editor-trainer-count");
	const sendButton = $("note-editor-trainer-send");
	const isTrainerNote = editingNoteMetadata?.source === AI_TRAINER_NOTE_SOURCE;
	if (!wrap || !thread || !input || !count || !sendButton) return;
	wrap.classList.toggle("hidden", !isTrainerNote);
	if (!isTrainerNote) {
		thread.innerHTML = "";
		count.textContent = `0 / ${TRAINER_NOTE_CONVERSATION_MAX_CHARS}`;
		sendButton.disabled = true;
		sendButton.textContent = "Send to trainer";
		return;
	}
	const note = getEditingNote();
	const conversation = parseTrainerConversationMessages(note?.trainerResponse);
	thread.innerHTML = "";
	if (!conversation.length) {
		const empty = document.createElement("div");
		empty.className = "note-trainer-thread-empty";
		empty.textContent =
			"No follow-up messages yet. Ask the trainer about this specific note.";
		thread.appendChild(empty);
	} else {
		conversation.forEach((message) => {
			const bubble = document.createElement("div");
			bubble.className = `note-trainer-message note-trainer-message--${message.role}`;
			const role = document.createElement("div");
			role.className = "note-trainer-message-role";
			role.textContent = message.role === "trainer" ? "Trainer" : "You";
			const text = document.createElement("div");
			text.textContent = message.content;
			bubble.appendChild(role);
			bubble.appendChild(text);
			thread.appendChild(bubble);
		});
		thread.scrollTop = thread.scrollHeight;
	}
	const messageDraft = normalizeSingleParagraph(
		input.value,
		TRAINER_NOTE_CONVERSATION_MAX_CHARS,
	);
	count.textContent = `${messageDraft.length} / ${TRAINER_NOTE_CONVERSATION_MAX_CHARS}`;
	sendButton.disabled =
		!messageDraft || Boolean(noteEditorTrainerConversationAbortController);
	sendButton.textContent = noteEditorTrainerConversationAbortController
		? "Sending..."
		: "Send to trainer";
}

async function sendNoteEditorTrainerMessage() {
	if (editingNoteMetadata?.source !== AI_TRAINER_NOTE_SOURCE || !editingNoteId)
		return;
	const input = $("note-editor-trainer-response");
	if (!input) return;
	if (noteEditorTrainerConversationAbortController) {
		noteEditorTrainerConversationAbortController.abort();
		return;
	}
	const note = getEditingNote();
	if (!note) {
		showToast("Could not load this note");
		return;
	}
	const message = normalizeSingleParagraph(
		input.value,
		TRAINER_NOTE_CONVERSATION_MAX_CHARS,
	);
	if (!message) {
		showToast("Write a message first");
		renderNoteEditorTrainerConversation();
		return;
	}
	const existingConversation = parseTrainerConversationMessages(
		note.trainerResponse,
	);
	const abortController = new AbortController();
	noteEditorTrainerConversationAbortController = abortController;
	renderNoteEditorTrainerConversation();
	try {
		const reply = await generateAITrainerNoteConversationResponse({
			note,
			message,
			conversation: existingConversation,
			rangeOverride: getAITrainerNotesRangeOverride(),
			providerOverride: getAITrainerProviderOverride(),
			signal: abortController.signal,
		});
		if (!reply) return;
		const updatedConversation = [
			...existingConversation,
			{ role: "user", content: message },
			{ role: "trainer", content: reply },
		];
		try {
			await updateNote(editingNoteId, {
				text: $("note-editor-content").value.trim(),
				calorieEntry: buildCalorieEntryFromEditor(),
				trainerResponse:
					serializeTrainerConversationMessages(updatedConversation),
				dateKey: editingNoteDateKey,
				fastContext: editingNoteContext,
				createdAt: editingNoteCreatedAt,
				metadata: editingNoteMetadata,
			});
		} catch (err) {
			if (err?.message === "missing-key") {
				handleNotesDecryptError(err);
				return;
			}
		}
		input.value = "";
		renderNotes();
		showToast("Trainer replied");
	} finally {
		if (noteEditorTrainerConversationAbortController === abortController) {
			noteEditorTrainerConversationAbortController = null;
		}
		renderNoteEditorTrainerConversation();
	}
}

async function removeNote() {
	if (!editingNoteId) return;
	await deleteNote(editingNoteId);
	renderNotes();
	closeNoteEditor();
}

function startNotesListener(uid) {
	stopNotesListener();
	notesLoaded = false;
	notes = [];
	renderNotes();

	notesUnsubscribe = onSnapshot(
		getNotesCollectionRef(uid),
		async (snap) => {
			try {
				const normalized = await Promise.all(
					snap.docs.map(normalizeNoteSnapshot),
				);
				notesLoaded = true;
				notes = normalized.sort(
					(a, b) => (b.updatedAt || 0) - (a.updatedAt || 0),
				);
				renderNotes();
			} catch (err) {
				handleNotesDecryptError(err);
			}
		},
		(err) => {
			console.error("Notes listener failed:", err);
			notesLoaded = true;
			notes = [];
			renderNotes();

			const code = err?.code || "";
			if (code === "permission-denied")
				showToast("Notes blocked by Firestore rules / App Check.");
			else if (code === "failed-precondition")
				showToast("Notes failed-precondition (index/AppCheck/offline).");
			else showToast(`Notes failed to load (${code || "unknown error"})`);
		},
	);
}

function stopStateListener() {
	if (stateUnsubscribe) {
		stateUnsubscribe();
		stateUnsubscribe = null;
	}
}

function startStateListener(uid) {
	stopStateListener();
	stateUnsubscribe = onSnapshot(getStateDocRef(uid), async (snap) => {
		const payload = snap.data()?.payload;
		if (!payload || !payload.iv || !payload.ciphertext) {
			state = clone(defaultState);
			selectedFastTypeId = resolveFastTypeId(state.settings.defaultFastTypeId);
			pendingTypeId = null;
			renderAll();
			return;
		}
		if (!cryptoKey) return;
		try {
			const decrypted = await decryptStatePayload(payload);
			state = mergeStateWithDefaults(decrypted);
			renderAll();
		} catch {}
	});
}

function getEncryptedCache() {
	try {
		const raw = localStorage.getItem(ENCRYPTED_CACHE_KEY);
		if (!raw) return null;
		return JSON.parse(raw);
	} catch {
		return null;
	}
}

function setEncryptedCache(payload) {
	try {
		localStorage.setItem(ENCRYPTED_CACHE_KEY, JSON.stringify(payload));
	} catch {}
}

function getWrappedKeyStorage(uid) {
	try {
		const raw = localStorage.getItem(`${WRAPPED_KEY_STORAGE_KEY}:${uid}`);
		if (!raw) return null;
		return JSON.parse(raw);
	} catch {
		return null;
	}
}

function setWrappedKeyStorage(uid, payload) {
	try {
		localStorage.setItem(
			`${WRAPPED_KEY_STORAGE_KEY}:${uid}`,
			JSON.stringify(payload),
		);
	} catch {}
}

function clearWrappedKeyStorage(uid) {
	try {
		localStorage.removeItem(`${WRAPPED_KEY_STORAGE_KEY}:${uid}`);
	} catch {}
}

function openDeviceKeyDb() {
	return new Promise((resolve, reject) => {
		const req = indexedDB.open(DEVICE_KEY_DB, 1);
		req.onupgradeneeded = () => {
			req.result.createObjectStore(DEVICE_KEY_STORE);
		};
		req.onsuccess = () => resolve(req.result);
		req.onerror = () => reject(req.error);
	});
}

async function loadDeviceWrappingKey() {
	try {
		const db = await openDeviceKeyDb();
		return await new Promise((resolve, reject) => {
			const tx = db.transaction(DEVICE_KEY_STORE, "readonly");
			const store = tx.objectStore(DEVICE_KEY_STORE);
			const req = store.get(DEVICE_KEY_ID);
			req.onsuccess = () => resolve(req.result || null);
			req.onerror = () => reject(req.error);
		});
	} catch {
		return null;
	}
}

async function saveDeviceWrappingKey(key) {
	try {
		const db = await openDeviceKeyDb();
		await new Promise((resolve, reject) => {
			const tx = db.transaction(DEVICE_KEY_STORE, "readwrite");
			const store = tx.objectStore(DEVICE_KEY_STORE);
			const req = store.put(key, DEVICE_KEY_ID);
			req.onsuccess = () => resolve();
			req.onerror = () => reject(req.error);
		});
	} catch {}
}

async function getOrCreateDeviceWrappingKey() {
	const existing = await loadDeviceWrappingKey();
	if (existing) return existing;
	const key = await crypto.subtle.generateKey(
		{ name: "AES-GCM", length: 256 },
		false,
		["wrapKey", "unwrapKey"],
	);
	await saveDeviceWrappingKey(key);
	return key;
}

async function wrapEncryptionKeyForDevice(uid) {
	if (!cryptoKey) return;
	const wrappingKey = await getOrCreateDeviceWrappingKey();
	const iv = crypto.getRandomValues(new Uint8Array(12));
	const wrapped = await crypto.subtle.wrapKey("raw", cryptoKey, wrappingKey, {
		name: "AES-GCM",
		iv,
	});
	setWrappedKeyStorage(uid, {
		version: ENCRYPTION_VERSION,
		iv: encodeBase64(iv),
		wrappedKey: encodeBase64(new Uint8Array(wrapped)),
	});
}

async function unwrapEncryptionKeyFromDevice(uid) {
	const cached = getWrappedKeyStorage(uid);
	if (!cached?.iv || !cached?.wrappedKey) return null;
	const wrappingKey = await loadDeviceWrappingKey();
	if (!wrappingKey) return null;
	try {
		const iv = decodeBase64(cached.iv);
		const wrappedBytes = decodeBase64(cached.wrappedKey);
		return await crypto.subtle.unwrapKey(
			"raw",
			wrappedBytes,
			wrappingKey,
			{ name: "AES-GCM", iv },
			{ name: "AES-GCM", length: 256 },
			true,
			["encrypt", "decrypt"],
		);
	} catch {
		return null;
	}
}

function mergeStateWithDefaults(parsed) {
	const merged = clone(defaultState);
	const parsedSettings = parsed.settings || {};
	const parsedTheme = parsedSettings.theme || {};
	if (typeof parsedSettings.showRingEmojis !== "boolean") {
		parsedSettings.showRingEmojis = defaultState.settings.showRingEmojis;
	}
	if (parsedTheme.accentColor && !parsedTheme.primaryColor) {
		parsedTheme.primaryColor = parsedTheme.accentColor;
	}
	if (parsedTheme.accentColorStrong && !parsedTheme.secondaryColor) {
		parsedTheme.secondaryColor = parsedTheme.accentColorStrong;
	}
	merged.settings = Object.assign(merged.settings, parsedSettings);
	merged.settings.theme = Object.assign(
		{},
		defaultState.settings.theme,
		parsedTheme,
	);
	merged.settings.calories = mergeCalorieSettings(parsedSettings.calories);
	merged.settings.llmProvider = normalizeLLMProvider(
		merged.settings.llmProvider,
	);
	merged.settings.openaiModel = normalizeOpenAIModel(
		merged.settings.openaiModel,
	);
	merged.settings.openaiReasoningEffort = normalizeOpenAIReasoningEffort(
		merged.settings.openaiReasoningEffort,
	);
	merged.settings.openaiTrainerInstructions =
		typeof merged.settings.openaiTrainerInstructions === "string"
			? merged.settings.openaiTrainerInstructions
			: "";
	merged.settings.openaiNotesRange = normalizeOpenAINotesRange(
		merged.settings.openaiNotesRange,
	);
	merged.settings.byoLlm = normalizeByoLlmSettings(merged.settings.byoLlm);
	merged.activeFast = parsed.activeFast || null;
	merged.history = Array.isArray(parsed.history) ? parsed.history : [];
	merged.reminders = Object.assign(merged.reminders, parsed.reminders || {});
	merged.milestoneTally =
		parsed?.milestoneTally && typeof parsed.milestoneTally === "object"
			? parsed.milestoneTally
			: {};
	if (merged.activeFast && !Array.isArray(merged.activeFast.milestonesHit)) {
		merged.activeFast.milestonesHit = [];
	}
	return merged;
}

function normalizeHistoryEntries(entries = []) {
	const mergedEntries = [];
	const entriesById = new Map();
	let changed = false;

	entries.forEach((entry) => {
		if (!entry || typeof entry !== "object") return;

		const normalized = { ...entry };
		const startTs = Number(normalized.startTimestamp);
		const endTs = Number(normalized.endTimestamp);
		const durationHours = computeDurationHours(startTs, endTs);

		if (durationHours !== null && normalized.durationHours !== durationHours) {
			normalized.durationHours = durationHours;
			changed = true;
		}

		if (normalized.id) {
			const existing = entriesById.get(normalized.id);
			if (existing) {
				const mergedStart = mergeTimestamp(
					existing.startTimestamp,
					startTs,
					Math.min,
				);
				const mergedEnd = mergeTimestamp(
					existing.endTimestamp,
					endTs,
					Math.max,
				);
				if (mergedStart !== existing.startTimestamp) {
					existing.startTimestamp = mergedStart;
					changed = true;
				}
				if (mergedEnd !== existing.endTimestamp) {
					existing.endTimestamp = mergedEnd;
					changed = true;
				}
				if (!existing.typeId && normalized.typeId) {
					existing.typeId = normalized.typeId;
					changed = true;
				}
				if (!existing.status && normalized.status) {
					existing.status = normalized.status;
					changed = true;
				}
				const mergedDuration = computeDurationHours(
					existing.startTimestamp,
					existing.endTimestamp,
				);
				if (
					mergedDuration !== null &&
					existing.durationHours !== mergedDuration
				) {
					existing.durationHours = mergedDuration;
					changed = true;
				}
			} else {
				entriesById.set(normalized.id, normalized);
				mergedEntries.push(normalized);
			}
			return;
		}

		mergedEntries.push(normalized);
	});

	return { entries: mergedEntries, changed };
}

function mergeTimestamp(existing, incoming, picker) {
	const hasExisting = Number.isFinite(existing);
	const hasIncoming = Number.isFinite(incoming);
	if (hasExisting && hasIncoming) return picker(existing, incoming);
	if (hasIncoming) return incoming;
	if (hasExisting) return existing;
	return existing;
}

function computeDurationHours(startTs, endTs) {
	if (!Number.isFinite(startTs) || !Number.isFinite(endTs) || endTs <= startTs)
		return null;
	return Math.round(((endTs - startTs) / 3600000) * 100) / 100;
}

async function deriveKeyFromPassword(password, saltBytes) {
	const keyMaterial = await crypto.subtle.importKey(
		"raw",
		new TextEncoder().encode(password),
		"PBKDF2",
		false,
		["deriveKey"],
	);
	return crypto.subtle.deriveKey(
		{
			name: "PBKDF2",
			salt: saltBytes,
			iterations: PBKDF2_ITERATIONS,
			hash: "SHA-256",
		},
		keyMaterial,
		{ name: "AES-GCM", length: 256 },
		true,
		["encrypt", "decrypt"],
	);
}

async function encryptStatePayload() {
	if (!cryptoKey) throw new Error("missing-key");
	const iv = crypto.getRandomValues(new Uint8Array(12));
	const encodedState = new TextEncoder().encode(JSON.stringify(state));
	const cipherBuffer = await crypto.subtle.encrypt(
		{ name: "AES-GCM", iv },
		cryptoKey,
		encodedState,
	);
	return {
		version: ENCRYPTION_VERSION,
		iv: encodeBase64(iv),
		ciphertext: encodeBase64(new Uint8Array(cipherBuffer)),
	};
}

async function decryptStatePayload(payload) {
	if (!cryptoKey) throw new Error("missing-key");
	const iv = decodeBase64(payload.iv);
	const ciphertext = decodeBase64(payload.ciphertext);
	const decryptedBuffer = await crypto.subtle.decrypt(
		{ name: "AES-GCM", iv },
		cryptoKey,
		ciphertext,
	);
	const decoded = new TextDecoder().decode(decryptedBuffer);
	return JSON.parse(decoded);
}

async function encryptNotePayload(notePayload) {
	if (!cryptoKey) throw new Error("missing-key");
	const iv = crypto.getRandomValues(new Uint8Array(12));
	let serializedPayload = "";
	if (typeof notePayload === "string") {
		serializedPayload = notePayload;
	} else if (notePayload && typeof notePayload === "object") {
		serializedPayload = JSON.stringify({
			text: typeof notePayload.text === "string" ? notePayload.text : "",
			calorieEntry: notePayload.calorieEntry ?? null,
			trainerResponse:
				typeof notePayload.trainerResponse === "string"
					? notePayload.trainerResponse
					: "",
		});
	}
	const encodedText = new TextEncoder().encode(serializedPayload);
	const cipherBuffer = await crypto.subtle.encrypt(
		{ name: "AES-GCM", iv },
		cryptoKey,
		encodedText,
	);
	return {
		version: ENCRYPTION_VERSION,
		iv: encodeBase64(iv),
		ciphertext: encodeBase64(new Uint8Array(cipherBuffer)),
	};
}

async function decryptNotePayload(payload) {
	if (!cryptoKey) throw new Error("missing-key");
	if (!payload?.iv || !payload?.ciphertext) throw new Error("invalid-payload");
	const iv = decodeBase64(payload.iv);
	const ciphertext = decodeBase64(payload.ciphertext);
	const decryptedBuffer = await crypto.subtle.decrypt(
		{ name: "AES-GCM", iv },
		cryptoKey,
		ciphertext,
	);
	const decoded = new TextDecoder().decode(decryptedBuffer);
	try {
		const parsed = JSON.parse(decoded);
		if (
			parsed &&
			typeof parsed === "object" &&
			("text" in parsed ||
				"calorieEntry" in parsed ||
				"trainerResponse" in parsed)
		) {
			return parsed;
		}
	} catch {}
	return decoded;
}

async function encryptApiKey(apiKeyValue) {
	if (!cryptoKey) throw new Error("missing-key");
	if (!apiKeyValue || typeof apiKeyValue !== "string") return null;
	const iv = crypto.getRandomValues(new Uint8Array(12));
	const encodedKey = new TextEncoder().encode(apiKeyValue);
	const cipherBuffer = await crypto.subtle.encrypt(
		{ name: "AES-GCM", iv },
		cryptoKey,
		encodedKey,
	);
	return {
		version: ENCRYPTION_VERSION,
		iv: encodeBase64(iv),
		ciphertext: encodeBase64(new Uint8Array(cipherBuffer)),
	};
}

async function decryptApiKey(payload) {
	if (!cryptoKey) throw new Error("missing-key");
	if (!payload?.iv || !payload?.ciphertext) return null;
	const iv = decodeBase64(payload.iv);
	const ciphertext = decodeBase64(payload.ciphertext);
	const decryptedBuffer = await crypto.subtle.decrypt(
		{ name: "AES-GCM", iv },
		cryptoKey,
		ciphertext,
	);
	return new TextDecoder().decode(decryptedBuffer);
}

async function saveSecureKey(keyName, keyValue) {
	const user = auth.currentUser;
	if (!user) return;

	const encryptedKey = await encryptApiKey(keyValue);
	if (!encryptedKey) return;

	await setDoc(
		getUserDocRef(user.uid),
		{
			secure_keys: {
				[keyName]: encryptedKey,
			},
		},
		{ merge: true },
	);
}

async function loadSecureKeys() {
	const user = auth.currentUser;
	if (!user) return {};

	const userDoc = await getDoc(getUserDocRef(user.uid));
	const secureKeys = userDoc.data()?.secure_keys || {};

	const decryptedKeys = {};
	for (const [keyName, encryptedPayload] of Object.entries(secureKeys)) {
		try {
			const decryptedValue = await decryptApiKey(encryptedPayload);
			if (decryptedValue) {
				decryptedKeys[keyName] = decryptedValue;
			}
		} catch (err) {
			console.error(`Failed to decrypt secure key: ${keyName}`, err);
		}
	}

	return decryptedKeys;
}

function handleNotesDecryptError(err) {
	const message =
		err?.message === "missing-key" ? "missing-password" : err?.message;
	if (message === "missing-password" || message === "decrypt-failed") {
		cryptoKey = null;
		keySalt = null;
		showReauthPrompt("Please re-enter your password to decrypt your data.");
	}
}

async function resolveEncryptedPayload(uid) {
	try {
		const snap = await getDocFromServer(getStateDocRef(uid));
		if (snap.exists()) return snap.data()?.payload || null;
	} catch {}
	try {
		const snap = await getDoc(getStateDocRef(uid));
		if (snap.exists()) return snap.data()?.payload || null;
	} catch {}
	return getEncryptedCache();
}

async function resolveUserSalt(uid, payloadSalt) {
	let storedSalt = null;
	try {
		const snap = await getDoc(getUserDocRef(uid));
		storedSalt = snap.data()?.crypto?.salt || null;
	} catch {}

	if (!storedSalt && payloadSalt) {
		storedSalt = payloadSalt;
		try {
			await setDoc(
				getUserDocRef(uid),
				{ crypto: { salt: storedSalt } },
				{ merge: true },
			);
		} catch {}
	}

	if (!storedSalt) {
		storedSalt = encodeBase64(crypto.getRandomValues(new Uint8Array(16)));
		try {
			await setDoc(
				getUserDocRef(uid),
				{ crypto: { salt: storedSalt } },
				{ merge: true },
			);
		} catch {}
	}

	return decodeBase64(storedSalt);
}

async function loadState() {
	const user = auth.currentUser;
	if (!user) return clone(defaultState);

	const payload = await resolveEncryptedPayload(user.uid);
	const saltBytes = await resolveUserSalt(user.uid, payload?.salt);
	keySalt = saltBytes;

	if (!payload) {
		if (!cryptoKey) {
			if (pendingPassword) {
				cryptoKey = await deriveKeyFromPassword(pendingPassword, keySalt);
				pendingPassword = null;
				if (authRememberChoice) await wrapEncryptionKeyForDevice(user.uid);
			} else {
				const cachedKey = await unwrapEncryptionKeyFromDevice(user.uid);
				if (cachedKey) cryptoKey = cachedKey;
				else throw new Error("missing-password");
			}
		}

		const newState = clone(defaultState);

		// Load secure keys from user document even for new users
		try {
			const secureKeys = await loadSecureKeys();
			if (secureKeys.openaikey) {
				newState.settings.openaiApiKey = secureKeys.openaikey;
			}
			if (secureKeys.byollmapikey) {
				newState.settings.byoLlm.apiKey = secureKeys.byollmapikey;
			}
		} catch (err) {
			console.error("Failed to load secure keys:", err);
		}

		return newState;
	}

	if (!payload.iv || !payload.ciphertext) throw new Error("invalid-payload");

	if (!cryptoKey) {
		if (pendingPassword) {
			cryptoKey = await deriveKeyFromPassword(pendingPassword, keySalt);
			pendingPassword = null;
			if (authRememberChoice) await wrapEncryptionKeyForDevice(user.uid);
		} else {
			const cachedKey = await unwrapEncryptionKeyFromDevice(user.uid);
			if (cachedKey) cryptoKey = cachedKey;
			else throw new Error("missing-password");
		}
	}

	try {
		const decrypted = await decryptStatePayload(payload);
		const mergedState = mergeStateWithDefaults(decrypted);

		// Load secure keys from user document (takes priority for cross-device sync)
		try {
			const secureKeys = await loadSecureKeys();
			if (secureKeys.openaikey) {
				mergedState.settings.openaiApiKey = secureKeys.openaikey;
			}
			if (secureKeys.byollmapikey) {
				mergedState.settings.byoLlm.apiKey = secureKeys.byollmapikey;
			}
		} catch (err) {
			console.error("Failed to load secure keys:", err);
		}

		return mergedState;
	} catch {
		cryptoKey = null;
		keySalt = null;
		throw new Error("decrypt-failed");
	}
}

async function saveState() {
	const user = auth.currentUser;
	if (!user || !cryptoKey || !keySalt) return;

	const payload = await encryptStatePayload();
	payload.salt = encodeBase64(keySalt);

	try {
		await setDoc(getStateDocRef(user.uid), { payload }, { merge: true });
	} catch {}
	setEncryptedCache(payload);
}

async function markUserVerified(user) {
	if (!user) return;
	const payload = {
		email: user.email ?? null,
		emailVerified: Boolean(user.emailVerified),
		updatedAt: Date.now(),
	};
	if (user.emailVerified) payload.verifiedAt = Date.now();
	try {
		await setDoc(getUserDocRef(user.uid), payload, { merge: true });
	} catch {}
}

function initUI() {
	initTabs();
	initNavTooltips();
	initFastTypeChips();
	initCalories();
	initButtons();
	initSettings();
	initCalendar();
	renderAll();
}

function initAuthListener() {
	onAuthStateChanged(auth, async (user) => {
		if (user) {
			if (!user.emailVerified) {
				stopStateListener();
				stopNotesListener();
				notesLoaded = false;
				notes = [];
				showVerificationRequired(user);
				return;
			}
			try {
				await completeAuthFlow();
			} catch (err) {
				console.error("Failed to complete auth state restore:", err);
				if (
					err?.message === "missing-password" ||
					err?.message === "decrypt-failed"
				) {
					showReauthPrompt(
						"Please re-enter your password to decrypt your data.",
					);
					return;
				}
				showReauthPrompt(
					"We couldn't load your encrypted data. Please sign in again.",
				);
			}
		} else {
			stopStateListener();
			stopNotesListener();
			notesLoaded = false;
			notes = [];
			setAuthVisibility(false);
			stopTick();
			cryptoKey = null;
			keySalt = null;
			pendingPassword = null;
			needsUnlock = false;
			authRememberChoice = null;
			closeNotesDrawer(true);
		}
	});
}

function initAuthUI() {
	const form = $("auth-form");
	const toggle = $("auth-toggle");
	const resetBtn = $("auth-reset");
	const resendBtn = $("verify-email-resend");
	const refreshBtn = $("verify-email-refresh");
	const signOutBtn = $("verify-email-signout");
	const _passwordInput = $("auth-password");
	const _confirmInput = $("auth-password-confirm");
	form.addEventListener("submit", handleAuthSubmit);
	toggle.addEventListener("click", () => {
		authMode = authMode === "sign-in" ? "sign-up" : "sign-in";
		updateAuthMode();
	});
	resetBtn.addEventListener("click", handlePasswordReset);
	resendBtn.addEventListener("click", async () => {
		const user = auth.currentUser;
		if (!user) return;
		try {
			await sendEmailVerification(user);
			showToast("Verification email sent.");
		} catch (err) {
			showToast(err?.message || "Unable to resend verification email.");
		}
	});
	refreshBtn.addEventListener("click", async () => {
		const user = auth.currentUser;
		if (!user) return;
		try {
			await reload(user);
		} catch (err) {
			showToast(err?.message || "Unable to refresh verification status.");
			return;
		}
		if (auth.currentUser?.emailVerified) {
			await markUserVerified(auth.currentUser);
			setVerificationPanel({ visible: false });
			await completeAuthFlow();
		} else {
			showToast("Your email is still unverified.");
		}
	});
	signOutBtn.addEventListener("click", async () => {
		try {
			await signOut(auth);
		} catch {}
		setVerificationPanel({ visible: false });
		setAuthFormDisabled(false);
		$("auth-email").value = "";
		$("auth-password").value = "";
		$("auth-password-confirm").value = "";
	});
	updateAuthMode();
}

function updatePasswordMatchIndicator() {
	const isSignUp = authMode === "sign-up";
	const matchEl = $("auth-password-match");
	if (!isSignUp) {
		matchEl.classList.add("hidden");
		return;
	}

	const password = $("auth-password").value;
	const confirmPassword = $("auth-password-confirm").value;
	if (!password && !confirmPassword) {
		matchEl.classList.add("hidden");
		return;
	}

	const matches = password === confirmPassword;
	matchEl.textContent = matches
		? "Passwords match."
		: "Passwords do not match.";
	matchEl.classList.remove("hidden");
	matchEl.classList.toggle("text-emerald-400", matches);
	matchEl.classList.toggle("text-rose-400", !matches);
}

function updateAuthMode() {
	const isSignUp = authMode === "sign-up";
	$("auth-title").textContent = isSignUp
		? "Create your account"
		: "Welcome back";
	$("auth-subtitle").textContent = isSignUp
		? "Sign up to start tracking your fasts across devices."
		: "Sign in to keep your fasting history synced.";
	$("auth-submit").textContent = isSignUp ? "Create account" : "Sign in";
	$("auth-toggle-text").textContent = isSignUp
		? "Already have an account?"
		: "New here?";
	$("auth-toggle").textContent = isSignUp ? "Sign in" : "Create an account";
	$("auth-reset").classList.toggle("hidden", isSignUp);
	$("auth-error").classList.add("hidden");
	$("auth-error").textContent = "";
	setVerificationPanel({ visible: false });
	const confirmGroup = $("auth-confirm-group");
	const confirmInput = $("auth-password-confirm");
	const matchEl = $("auth-password-match");
	confirmGroup.classList.toggle("hidden", !isSignUp);
	confirmInput.disabled = !isSignUp;
	confirmInput.required = isSignUp;
	confirmInput.value = "";
	matchEl.classList.add("hidden");
	matchEl.textContent = "";
	updatePasswordMatchIndicator();
}

function showReauthPrompt(message) {
	authMode = "sign-in";
	updateAuthMode();
	if (auth.currentUser?.email) $("auth-email").value = auth.currentUser.email;
	$("auth-password").value = "";
	const errorEl = $("auth-error");
	errorEl.textContent = message;
	errorEl.classList.remove("hidden");
	needsUnlock = true;
	setAuthVisibility(false);
}

function setAuthFormDisabled(disabled) {
	const form = $("auth-form");
	if (!form) return;
	const controls = form.querySelectorAll("input, button");
	controls.forEach((control) => {
		control.disabled = disabled;
	});
	form.classList.toggle("opacity-60", disabled);
	form.classList.toggle("pointer-events-none", disabled);
	const toggle = $("auth-toggle");
	toggle.disabled = disabled;
	toggle.classList.toggle("opacity-60", disabled);
	toggle.classList.toggle("pointer-events-none", disabled);
}

function setVerificationPanel({ visible, email = "" } = {}) {
	const panel = $("verify-email-panel");
	if (!panel) return;
	panel.classList.toggle("hidden", !visible);
	$("verify-email-address").textContent = email || "your inbox";
	setAuthFormDisabled(visible);
}

function showVerificationRequired(user) {
	authMode = "sign-in";
	updateAuthMode();
	if (user?.email) $("auth-email").value = user.email;
	$("auth-error").classList.add("hidden");
	$("auth-error").textContent = "";
	setVerificationPanel({ visible: true, email: user?.email || "" });
	setAuthVisibility(false);
}

function setAuthVisibility(isAuthed) {
	$("app").classList.toggle("hidden", !isAuthed);
	$("auth-screen").classList.toggle("hidden", isAuthed);
}

async function handleAuthSubmit(e) {
	e.preventDefault();
	const email = $("auth-email").value.trim();
	const password = $("auth-password").value;
	const remember = $("auth-remember").checked;
	const errorEl = $("auth-error");

	errorEl.classList.add("hidden");
	errorEl.textContent = "";

	if (!email || !password) {
		errorEl.textContent = "Please enter both an email and password.";
		errorEl.classList.remove("hidden");
		return;
	}
	if (authMode === "sign-up") {
		const confirmPassword = $("auth-password-confirm").value;
		if (!confirmPassword) {
			errorEl.textContent = "Please confirm your password.";
			errorEl.classList.remove("hidden");
			updatePasswordMatchIndicator();
			return;
		}
		if (password !== confirmPassword) {
			errorEl.textContent = "Passwords do not match.";
			errorEl.classList.remove("hidden");
			updatePasswordMatchIndicator();
			return;
		}
	}

	try {
		pendingPassword = password;
		authRememberChoice = remember;
		await setPersistence(
			auth,
			remember ? browserLocalPersistence : browserSessionPersistence,
		);
		if (authMode === "sign-up") {
			await createUserWithEmailAndPassword(auth, email, password);
			if (auth.currentUser) {
				try {
					await setDoc(
						getUserDocRef(auth.currentUser.uid),
						{
							email: auth.currentUser.email ?? email,
							emailVerified: auth.currentUser.emailVerified,
							createdAt: Date.now(),
							updatedAt: Date.now(),
						},
						{ merge: true },
					);
				} catch {}
				try {
					await sendEmailVerification(auth.currentUser);
				} catch (err) {
					showToast(err?.message || "Unable to send verification email.");
				}
			}
		} else {
			await signInWithEmailAndPassword(auth, email, password);
		}

		if (auth.currentUser && !remember)
			clearWrappedKeyStorage(auth.currentUser.uid);

		if (needsUnlock && auth.currentUser) {
			try {
				await completeAuthFlow();
			} catch (err) {
				console.error("Failed to complete sign-in flow:", err);
				if (err?.message === "decrypt-failed") {
					showReauthPrompt("Incorrect password. Please try again.");
					return;
				}
				showReauthPrompt(
					"We couldn't finish loading the app. Please refresh and try again.",
				);
			}
		}
	} catch (err) {
		pendingPassword = null;
		authRememberChoice = null;
		errorEl.textContent =
			err?.message || "Unable to authenticate. Please try again.";
		errorEl.classList.remove("hidden");
	}
}

async function handlePasswordReset() {
	const email = $("auth-email").value.trim();
	const errorEl = $("auth-error");
	const resetBtn = $("auth-reset");

	errorEl.classList.add("hidden");
	errorEl.textContent = "";

	if (!email) {
		errorEl.textContent = "Enter your email to reset your password.";
		errorEl.classList.remove("hidden");
		return;
	}

	resetBtn.disabled = true;
	resetBtn.classList.add("opacity-60", "pointer-events-none");

	try {
		await sendPasswordResetEmail(auth, email);
		showToast("Password reset email sent.");
	} catch (err) {
		errorEl.textContent =
			err?.message || "Unable to send password reset email.";
		errorEl.classList.remove("hidden");
	} finally {
		resetBtn.disabled = false;
		resetBtn.classList.remove("opacity-60", "pointer-events-none");
	}
}

async function completeAuthFlow() {
	if (auth.currentUser?.emailVerified) await markUserVerified(auth.currentUser);
	await loadAppState();
	pendingPassword = null;
	authRememberChoice = null;
	startStateListener(auth.currentUser.uid);
	startNotesListener(auth.currentUser.uid);
	if (!appInitialized) {
		initUI();
		registerServiceWorker();
		appInitialized = true;
	}
	startTick();
	renderAll();
	needsUnlock = false;
	setAuthVisibility(true);
}

async function loadAppState() {
	state = await loadState();
	const normalizedHistory = normalizeHistoryEntries(state.history);
	if (normalizedHistory.changed) {
		state.history = normalizedHistory.entries;
		void saveState();
	}
	selectedFastTypeId = resolveFastTypeId(state.settings.defaultFastTypeId);
	pendingTypeId = null;
	calendarMonth = startOfMonth(new Date());
	selectedDayKey = formatDateKey(new Date());
}

// Ensure Notes drawer is an overlay (fixed, above tabs) and closes on outside click
function ensureNotesOverlay() {
	if (notesPortal) return;

	const drawer = $("tab-notes");
	if (!drawer) return;

	notesPortal = document.createElement("div");
	notesPortal.id = "notes-portal";
	notesPortal.style.position = "fixed";
	notesPortal.style.inset = "0";
	notesPortal.style.zIndex = String(Z_INDEX_OVERLAY_PORTAL);
	notesPortal.style.display = "none";
	notesPortal.style.pointerEvents = "auto";
	notesPortal.style.touchAction = "pan-y";
	notesPortal.style.overscrollBehaviorX = "contain";

	notesBackdrop = document.createElement("div");
	notesBackdrop.id = "notes-backdrop";
	notesBackdrop.style.position = "absolute";
	notesBackdrop.style.inset = "0";
	notesBackdrop.style.background = "rgba(0,0,0,0.55)";
	notesBackdrop.style.backdropFilter = "blur(2px)";
	notesBackdrop.style.webkitBackdropFilter = "blur(2px)";

	notesPortal.appendChild(notesBackdrop);

	// Move drawer into portal so it can sit above everything
	notesPortal.appendChild(drawer);

	// Make the drawer behave like a right-side sheet on desktop, full width on mobile
	drawer.style.position = "absolute";
	drawer.style.top = "0";
	drawer.style.right = "0";
	drawer.style.bottom = "0";
	drawer.style.left = "auto";
	drawer.style.width = "min(420px, 100vw)";
	drawer.style.maxWidth = "100vw";
	drawer.style.height = "100%";
	drawer.style.overflow = "auto";
	drawer.style.zIndex = "10000";

	// Prevent clicks inside the drawer from closing it via backdrop
	drawer.addEventListener("mousedown", (e) => e.stopPropagation());
	drawer.addEventListener("touchstart", (e) => e.stopPropagation(), {
		passive: true,
	});
	drawer.addEventListener("click", (e) => e.stopPropagation());

	if (!notesSwipeHandlersAttached && navigator.maxTouchPoints > 0) {
		notesSwipeHandlersAttached = true;
		let swipeStartX = 0;
		let swipeStartY = 0;
		let swipeTracking = false;

		notesPortal.addEventListener(
			"touchstart",
			(e) => {
				if (!notesOverlayOpen || !e.touches || e.touches.length !== 1) return;
				const touch = e.touches[0];
				swipeStartX = touch.clientX;
				swipeStartY = touch.clientY;
				swipeTracking = true;
			},
			{ passive: true, capture: true },
		);

		notesPortal.addEventListener(
			"touchmove",
			(e) => {
				if (!swipeTracking || !e.touches || e.touches.length !== 1) return;
				const touch = e.touches[0];
				const deltaX = touch.clientX - swipeStartX;
				const deltaY = Math.abs(touch.clientY - swipeStartY);
				if (deltaY > 60 && deltaY > Math.abs(deltaX)) {
					swipeTracking = false;
				}
			},
			{ passive: true, capture: true },
		);

		notesPortal.addEventListener(
			"touchend",
			(e) => {
				if (!swipeTracking || !notesOverlayOpen) return;
				const touch = e.changedTouches?.[0];
				if (!touch) return;
				const deltaX = touch.clientX - swipeStartX;
				const deltaY = Math.abs(touch.clientY - swipeStartY);
				if (deltaX > 60 && deltaY < 40) {
					closeNotesDrawer();
				}
				swipeTracking = false;
			},
			{ passive: true, capture: true },
		);
	}

	notesBackdrop.addEventListener("click", () => closeNotesDrawer());
	document.addEventListener("keydown", (e) => {
		if (e.key === "Escape" && notesOverlayOpen) closeNotesDrawer();
	});

	document.body.appendChild(notesPortal);
}

function setNotesNavActive(on) {
	const notesBtn = document.querySelector('nav .nav-btn[data-tab="notes"]');
	if (!notesBtn) return;
	notesBtn.classList.toggle("nav-btn-active", !!on);
	notesBtn.classList.toggle("text-default", !!on);
	notesBtn.classList.toggle("text-subtle", !on);
}

function openNotesDrawer() {
	ensureNotesOverlay();
	const drawer = $("tab-notes");
	if (!drawer || !notesPortal) return;

	if (notesDrawerCloseTimeout) {
		clearTimeout(notesDrawerCloseTimeout);
		notesDrawerCloseTimeout = null;
	}

	if (bodyOverflowBeforeNotes === null)
		bodyOverflowBeforeNotes = document.body.style.overflow || "";
	document.body.style.overflow = "hidden";

	notesPortal.style.display = "block";
	drawer.classList.remove("hidden");
	requestAnimationFrame(() => drawer.classList.add("is-open"));

	notesOverlayOpen = true;
	setNotesNavActive(true);
	seedAITrainerNotesRangeOverride();
	renderNotes();
}

function closeNotesDrawer(forceImmediate = false) {
	const drawer = $("tab-notes");
	if (!drawer || !notesPortal) {
		notesOverlayOpen = false;
		setNotesNavActive(false);
		clearAITrainerNotesRangeOverride();
		if (bodyOverflowBeforeNotes !== null) {
			document.body.style.overflow = bodyOverflowBeforeNotes;
			bodyOverflowBeforeNotes = null;
		}
		return;
	}

	notesOverlayOpen = false;
	setNotesNavActive(false);
	clearAITrainerNotesRangeOverride();

	drawer.classList.remove("is-open");

	if (forceImmediate) {
		drawer.classList.add("hidden");
		notesPortal.style.display = "none";
		if (bodyOverflowBeforeNotes !== null) {
			document.body.style.overflow = bodyOverflowBeforeNotes;
			bodyOverflowBeforeNotes = null;
		}
		return;
	}

	if (notesDrawerCloseTimeout) clearTimeout(notesDrawerCloseTimeout);
	notesDrawerCloseTimeout = setTimeout(() => {
		drawer.classList.add("hidden");
		notesPortal.style.display = "none";
		if (bodyOverflowBeforeNotes !== null) {
			document.body.style.overflow = bodyOverflowBeforeNotes;
			bodyOverflowBeforeNotes = null;
		}
	}, 220);
}

function ensureSecondaryDrawerOverlay(drawerType) {
	const drawerMeta = getSecondaryDrawerMeta(drawerType);
	if (!drawerMeta?.drawer || drawerMeta.getPortal()) return;

	const portal = document.createElement("div");
	portal.style.position = "fixed";
	portal.style.inset = "0";
	portal.style.zIndex = String(Z_INDEX_OVERLAY_PORTAL);
	portal.style.display = "none";
	portal.style.pointerEvents = "auto";
	portal.style.touchAction = "pan-y";
	portal.style.overscrollBehaviorX = "contain";

	const backdrop = document.createElement("div");
	backdrop.style.position = "absolute";
	backdrop.style.inset = "0";
	backdrop.style.background = "rgba(0,0,0,0.55)";
	backdrop.style.backdropFilter = "blur(2px)";
	backdrop.style.webkitBackdropFilter = "blur(2px)";

	portal.appendChild(backdrop);
	portal.appendChild(drawerMeta.drawer);

	drawerMeta.drawer.style.position = "absolute";
	drawerMeta.drawer.style.top = "0";
	drawerMeta.drawer.style.right = "0";
	drawerMeta.drawer.style.bottom = "0";
	drawerMeta.drawer.style.left = "auto";
	drawerMeta.drawer.style.width = "min(420px, 100vw)";
	drawerMeta.drawer.style.maxWidth = "100vw";
	drawerMeta.drawer.style.height = "100%";
	drawerMeta.drawer.style.overflow = "auto";
	drawerMeta.drawer.style.zIndex = "10000";

	drawerMeta.drawer.addEventListener("mousedown", (e) => e.stopPropagation());
	drawerMeta.drawer.addEventListener("touchstart", (e) => e.stopPropagation(), {
		passive: true,
	});
	drawerMeta.drawer.addEventListener("click", (e) => e.stopPropagation());

	backdrop.addEventListener("click", () => closeSecondaryDrawer(drawerType));
	document.body.appendChild(portal);
	drawerMeta.setPortal(portal);

	if (!secondaryDrawerEscapeHandlerAttached) {
		secondaryDrawerEscapeHandlerAttached = true;
		document.addEventListener("keydown", (e) => {
			if (e.key !== "Escape") return;
			closeSecondaryDrawers();
		});
	}
}

function getSecondaryDrawerMeta(drawerType) {
	const drawerMap = {
		history: {
			drawer: $("history-progress-drawer"),
			getPortal: () => historyProgressPortal,
			setPortal: (portal) => {
				historyProgressPortal = portal;
			},
			getOpen: () => historyProgressOverlayOpen,
			setOpen: (open) => {
				historyProgressOverlayOpen = open;
			},
			getCloseTimeout: () => historyProgressDrawerCloseTimeout,
			setCloseTimeout: (timeout) => {
				historyProgressDrawerCloseTimeout = timeout;
			},
			button: $("history-progress-drawer-btn"),
		},
		historyNotes: {
			drawer: $("history-notes-drawer"),
			getPortal: () => historyNotesPortal,
			setPortal: (portal) => {
				historyNotesPortal = portal;
			},
			getOpen: () => historyNotesOverlayOpen,
			setOpen: (open) => {
				historyNotesOverlayOpen = open;
			},
			getCloseTimeout: () => historyNotesDrawerCloseTimeout,
			setCloseTimeout: (timeout) => {
				historyNotesDrawerCloseTimeout = timeout;
			},
			button: $("history-notes-drawer-btn"),
		},
		recentFasts: {
			drawer: $("recent-fasts-drawer"),
			getPortal: () => recentFastsPortal,
			setPortal: (portal) => {
				recentFastsPortal = portal;
			},
			getOpen: () => recentFastsOverlayOpen,
			setOpen: (open) => {
				recentFastsOverlayOpen = open;
			},
			getCloseTimeout: () => recentFastsDrawerCloseTimeout,
			setCloseTimeout: (timeout) => {
				recentFastsDrawerCloseTimeout = timeout;
			},
			button: $("recent-fasts-drawer-btn"),
		},
		nutrition: {
			drawer: $("nutrition-progress-drawer"),
			getPortal: () => nutritionProgressPortal,
			setPortal: (portal) => {
				nutritionProgressPortal = portal;
			},
			getOpen: () => nutritionProgressOverlayOpen,
			setOpen: (open) => {
				nutritionProgressOverlayOpen = open;
			},
			getCloseTimeout: () => nutritionProgressDrawerCloseTimeout,
			setCloseTimeout: (timeout) => {
				nutritionProgressDrawerCloseTimeout = timeout;
			},
			button: $("nutrition-progress-drawer-btn"),
		},
		calorieTarget: {
			drawer: $("calorie-target-drawer"),
			getPortal: () => calorieTargetPortal,
			setPortal: (portal) => {
				calorieTargetPortal = portal;
			},
			getOpen: () => calorieTargetOverlayOpen,
			setOpen: (open) => {
				calorieTargetOverlayOpen = open;
			},
			getCloseTimeout: () => calorieTargetDrawerCloseTimeout,
			setCloseTimeout: (timeout) => {
				calorieTargetDrawerCloseTimeout = timeout;
			},
			button: $("calorie-target-drawer-btn"),
		},
		calorieGoal: {
			drawer: $("calorie-goal-drawer"),
			getPortal: () => calorieGoalPortal,
			setPortal: (portal) => {
				calorieGoalPortal = portal;
			},
			getOpen: () => calorieGoalOverlayOpen,
			setOpen: (open) => {
				calorieGoalOverlayOpen = open;
			},
			getCloseTimeout: () => calorieGoalDrawerCloseTimeout,
			setCloseTimeout: (timeout) => {
				calorieGoalDrawerCloseTimeout = timeout;
			},
			button: $("calorie-goal-drawer-btn"),
		},
		settings: {
			drawer: $("tab-settings"),
			getPortal: () => settingsPortal,
			setPortal: (portal) => {
				settingsPortal = portal;
			},
			getOpen: () => settingsOverlayOpen,
			setOpen: (open) => {
				settingsOverlayOpen = open;
			},
			getCloseTimeout: () => settingsDrawerCloseTimeout,
			setCloseTimeout: (timeout) => {
				settingsDrawerCloseTimeout = timeout;
			},
			button: document.querySelector('nav .nav-btn[data-tab="settings"]'),
			navButton: true,
		},
	};
	return drawerMap[drawerType] || null;
}

function restoreSecondaryDrawerBodyOverflow() {
	if (
		historyProgressOverlayOpen ||
		historyNotesOverlayOpen ||
		recentFastsOverlayOpen ||
		nutritionProgressOverlayOpen ||
		calorieTargetOverlayOpen ||
		calorieGoalOverlayOpen ||
		settingsOverlayOpen
	)
		return;
	if (bodyOverflowBeforeSecondaryDrawers !== null) {
		document.body.style.overflow = bodyOverflowBeforeSecondaryDrawers;
		bodyOverflowBeforeSecondaryDrawers = null;
	}
}

function openSecondaryDrawer(drawerType, onOpen) {
	ensureSecondaryDrawerOverlay(drawerType);
	const drawerMeta = getSecondaryDrawerMeta(drawerType);
	if (!drawerMeta?.drawer || !drawerMeta.getPortal()) return;

	const existingCloseTimeout = drawerMeta.getCloseTimeout();
	if (existingCloseTimeout) {
		clearTimeout(existingCloseTimeout);
		drawerMeta.setCloseTimeout(null);
	}
	closeSecondaryDrawers(true, drawerType);

	if (bodyOverflowBeforeSecondaryDrawers === null)
		bodyOverflowBeforeSecondaryDrawers = document.body.style.overflow || "";
	document.body.style.overflow = "hidden";

	drawerMeta.getPortal().style.display = "block";
	drawerMeta.drawer.classList.remove("hidden");
	requestAnimationFrame(() => drawerMeta.drawer.classList.add("is-open"));
	drawerMeta.setOpen(true);
	if (drawerMeta.button)
		drawerMeta.button.setAttribute("aria-expanded", "true");
	if (drawerMeta.navButton && drawerMeta.button) {
		drawerMeta.button.classList.add("nav-btn-active", "text-default");
		drawerMeta.button.classList.remove("text-subtle");
	}
	if (typeof onOpen === "function") onOpen();
}

function closeSecondaryDrawer(drawerType, forceImmediate = false) {
	const drawerMeta = getSecondaryDrawerMeta(drawerType);
	if (!drawerMeta?.drawer || !drawerMeta.getPortal()) {
		if (drawerMeta) {
			drawerMeta.setOpen(false);
			if (drawerMeta.button)
				drawerMeta.button.setAttribute("aria-expanded", "false");
			if (drawerMeta.navButton && drawerMeta.button) {
				drawerMeta.button.classList.remove("nav-btn-active", "text-default");
				drawerMeta.button.classList.add("text-subtle");
			}
		}
		restoreSecondaryDrawerBodyOverflow();
		return;
	}

	drawerMeta.setOpen(false);
	if (drawerMeta.button)
		drawerMeta.button.setAttribute("aria-expanded", "false");
	if (drawerMeta.navButton && drawerMeta.button) {
		drawerMeta.button.classList.remove("nav-btn-active", "text-default");
		drawerMeta.button.classList.add("text-subtle");
	}
	drawerMeta.drawer.classList.remove("is-open");

	if (forceImmediate) {
		drawerMeta.drawer.classList.add("hidden");
		drawerMeta.getPortal().style.display = "none";
		restoreSecondaryDrawerBodyOverflow();
		return;
	}

	const existingCloseTimeout = drawerMeta.getCloseTimeout();
	if (existingCloseTimeout) clearTimeout(existingCloseTimeout);
	drawerMeta.setCloseTimeout(
		setTimeout(() => {
			drawerMeta.drawer.classList.add("hidden");
			drawerMeta.getPortal().style.display = "none";
			drawerMeta.setCloseTimeout(null);
			restoreSecondaryDrawerBodyOverflow();
		}, 220),
	);
}

function openHistoryProgressDrawer() {
	openSecondaryDrawer("history", () => {
		renderDayDetails();
	});
}

function closeHistoryProgressDrawer(forceImmediate = false) {
	closeSecondaryDrawer("history", forceImmediate);
}

function openHistoryNotesDrawer() {
	openSecondaryDrawer("historyNotes", () => {
		renderHistoryNotes();
	});
}

function closeHistoryNotesDrawer(forceImmediate = false) {
	closeSecondaryDrawer("historyNotes", forceImmediate);
}

function openRecentFastsDrawer() {
	openSecondaryDrawer("recentFasts", () => {
		renderRecentFasts();
	});
}

function closeRecentFastsDrawer(forceImmediate = false) {
	closeSecondaryDrawer("recentFasts", forceImmediate);
}

function openNutritionProgressDrawer() {
	openSecondaryDrawer("nutrition", () => {
		renderCalories();
	});
}

function closeNutritionProgressDrawer(forceImmediate = false) {
	closeSecondaryDrawer("nutrition", forceImmediate);
}

function openCalorieTargetDrawer() {
	openSecondaryDrawer("calorieTarget");
}

function closeCalorieTargetDrawer(forceImmediate = false) {
	closeSecondaryDrawer("calorieTarget", forceImmediate);
}

function openCalorieGoalDrawer() {
	openSecondaryDrawer("calorieGoal");
}

function closeCalorieGoalDrawer(forceImmediate = false) {
	closeSecondaryDrawer("calorieGoal", forceImmediate);
}

function openSettingsDrawer() {
	openSecondaryDrawer("settings", () => {
		renderSettings();
	});
}

function closeSettingsDrawer(forceImmediate = false) {
	closeSecondaryDrawer("settings", forceImmediate);
}

function closeSecondaryDrawers(forceImmediate = false, exceptType = null) {
	const drawerTypes = [
		"history",
		"historyNotes",
		"recentFasts",
		"nutrition",
		"calorieTarget",
		"calorieGoal",
		"settings",
	];
	drawerTypes.forEach((drawerType) => {
		if (drawerType === exceptType) return;
		closeSecondaryDrawer(drawerType, forceImmediate);
	});
}

function initTabs() {
	document.querySelectorAll("nav .nav-btn").forEach((btn) => {
		btn.addEventListener("click", (e) => {
			if (suppressNavClickEl === btn) {
				suppressNavClickEl = null;
				e.preventDefault();
				e.stopPropagation();
				return;
			}

			const tab = btn.dataset.tab;

			// Notes is now an overlay, not a real tab switch
			if (tab === "notes") {
				closeSecondaryDrawers(true);
				if (notesOverlayOpen) closeNotesDrawer();
				else openNotesDrawer();
				return;
			}

			if (tab === "settings") {
				if (notesOverlayOpen) closeNotesDrawer(true);
				if (settingsOverlayOpen) closeSettingsDrawer();
				else openSettingsDrawer();
				return;
			}

			// Switching tabs should close notes overlay if open
			if (notesOverlayOpen) closeNotesDrawer();
			closeSecondaryDrawers(true);

			switchTab(tab);
		});
	});

	switchTab("timer");
}

function switchTab(tab) {
	currentTab = tab;
	if (tab !== "notes") _lastNonNotesTab = tab;
	closeSecondaryDrawers(true);

	["timer", "history", "calories"].forEach((id) => {
		const section = $(`tab-${id}`);
		const btn = document.querySelector(`nav .nav-btn[data-tab="${id}"]`);
		const active = id === tab;
		section.classList.toggle("hidden", !active);
		btn.classList.toggle("nav-btn-active", active);
		btn.classList.toggle("text-default", active);
		btn.classList.toggle("text-subtle", !active);
	});

	document.body.classList.toggle("tab-no-scroll", tab === "timer");

	setNotesNavActive(false);

	if (tab === "history") {
		renderCalendar();
		renderDayDetails();
		renderRecentFasts();
		renderNotes();
	}
	if (tab === "calories") renderCalories();

	renderFastButton();
	renderCalorieButton();
}

function initNavTooltips() {
	const tooltip = $("nav-tooltip");
	const hide = () => {
		tooltip.classList.add("hidden");
		navHoldShown = false;
		clearTimeout(navHoldTimer);
		navHoldTimer = null;
	};

	const showFor = (btn) => {
		const label = btn.dataset.label || "";
		if (!label) return;
		const r = btn.getBoundingClientRect();
		tooltip.textContent = label;
		tooltip.classList.remove("hidden");

		const pad = 10;
		const tw = tooltip.offsetWidth || 90;
		const th = tooltip.offsetHeight || 24;
		let x = r.left + r.width / 2 - tw / 2;
		x = Math.max(pad, Math.min(window.innerWidth - tw - pad, x));
		let y = r.top - th - 10;
		if (y < pad) y = r.bottom + 10;
		tooltip.style.left = `${x}px`;
		tooltip.style.top = `${y}px`;
	};

	const startHold = (btn) => {
		clearTimeout(navHoldTimer);
		navHoldShown = false;
		suppressNavClickEl = null;
		navHoldTimer = setTimeout(() => {
			navHoldShown = true;
			suppressNavClickEl = btn;
			showFor(btn);
			setTimeout(() => {
				if (navHoldShown) hide();
			}, 1400);
		}, 420);
	};

	document.querySelectorAll("nav .nav-btn").forEach((btn) => {
		btn.addEventListener("touchstart", () => startHold(btn), { passive: true });
		btn.addEventListener("touchend", hide, { passive: true });
		btn.addEventListener("touchcancel", hide, { passive: true });

		btn.addEventListener("mousedown", () => startHold(btn));
		btn.addEventListener("mouseup", hide);
		btn.addEventListener("mouseleave", hide);
		btn.addEventListener("blur", hide);
	});

	window.addEventListener("scroll", hide, { passive: true });
	window.addEventListener("resize", hide, { passive: true });
}

function getTypeById(id) {
	if (!Array.isArray(FAST_TYPES) || FAST_TYPES.length === 0) return null;
	return FAST_TYPES.find((t) => t.id === id) || FAST_TYPES[0];
}

function getActiveType() {
	if (state.activeFast?.typeId) return getTypeById(state.activeFast.typeId);
	return getTypeById(selectedFastTypeId);
}

function mergeCalorieSettings(settings) {
	const next = {
		...defaultState.settings.calories,
		...(settings && typeof settings === "object" ? settings : {}),
	};
	const legacyTarget = Number(next.target);
	if (
		next.dailyTarget == null &&
		Number.isFinite(legacyTarget) &&
		legacyTarget > 0
	) {
		next.dailyTarget = legacyTarget;
	}
	if (next.currentWeight == null && next.bmi != null) {
		const legacyWeight = normalizeGoalMetric(next.bmi);
		if (legacyWeight != null) next.currentWeight = legacyWeight;
	}
	next.nutrientGoals = normalizeNutrientGoalSettings(next.nutrientGoals);
	if ("bmi" in next) delete next.bmi;
	return next;
}

function getCalorieSettings() {
	if (!state.settings.calories || typeof state.settings.calories !== "object") {
		state.settings.calories = mergeCalorieSettings();
	} else {
		state.settings.calories = mergeCalorieSettings(state.settings.calories);
	}
	return state.settings.calories;
}

function getCalorieUnitSystem() {
	const unitSystem = getCalorieSettings().unitSystem;
	return unitSystem === "imperial" ? "imperial" : "metric";
}

function parseCalorieValue(value) {
	const trimmed = String(value ?? "").trim();
	if (!trimmed) return null;
	const num = Number(trimmed);
	if (!Number.isFinite(num) || num < 0) return null;
	return num;
}

function ensureHeightSelectorsPopulated() {
	const feetSelect = $("calorie-height-feet-select");
	const inchesSelect = $("calorie-height-inches-select");
	[feetSelect, inchesSelect].forEach((selectEl) => {
		if (!selectEl || selectEl.options.length > 0) return;
		for (let value = 0; value <= MAX_IMPERIAL_HEIGHT_PART; value++) {
			const option = document.createElement("option");
			option.value = String(value);
			option.textContent = String(value);
			selectEl.appendChild(option);
		}
	});
}

function normalizeImperialHeight(heightValue) {
	const normalized = normalizeGoalMetric(heightValue);
	if (!Number.isFinite(normalized) || normalized <= 0) {
		return { feet: 0, inches: 0 };
	}
	const capped = Math.max(
		0,
		Math.min(
			normalized,
			MAX_IMPERIAL_HEIGHT_PART * 12 + MAX_IMPERIAL_HEIGHT_PART,
		),
	);
	const feet = Math.floor(capped / 12);
	const inches = Math.round(capped - feet * 12);
	return {
		feet,
		inches: Math.max(0, Math.min(inches, MAX_IMPERIAL_HEIGHT_PART)),
	};
}

function getHeightFromImperialSelectors() {
	const feet = Number($("calorie-height-feet-select")?.value);
	const inches = Number($("calorie-height-inches-select")?.value);
	if (!Number.isFinite(feet) || !Number.isFinite(inches)) return null;
	const normalizedFeet = Math.max(
		0,
		Math.min(Math.round(feet), MAX_IMPERIAL_HEIGHT_PART),
	);
	const normalizedInches = Math.max(
		0,
		Math.min(Math.round(inches), MAX_IMPERIAL_HEIGHT_PART),
	);
	const totalInches = normalizedFeet * 12 + normalizedInches;
	return totalInches > 0 ? totalInches : null;
}

function setCalorieTargetSettings(settings, target) {
	settings.dailyTarget = target;
	settings.target = target;
}

function getCalorieTarget() {
	const target = Number(getCalorieSettings().dailyTarget);
	return Number.isFinite(target) && target > 0 ? target : null;
}

function getCalorieConsumed() {
	const consumed = Number(getCalorieSettings().consumed);
	return Number.isFinite(consumed) && consumed > 0 ? consumed : 0;
}

function getCalorieDisplayDateKey() {
	const todayKey = formatDateKey(new Date());
	if (currentTab === "history" && selectedDayKey) return selectedDayKey;
	return todayKey;
}

function getNoteCaloriesForDateKey(dateKey = formatDateKey(new Date())) {
	if (!Array.isArray(notes) || notes.length === 0) return 0;
	return notes.reduce((sum, note) => {
		if (!note || note.dateKey !== dateKey) return sum;
		const calories = Number(note.calorieEntry?.calories);
		if (!Number.isFinite(calories)) return sum;
		return sum + calories;
	}, 0);
}

function getNoteNutritionTotalsForDateKey(dateKey = formatDateKey(new Date())) {
	const totals = {
		macros: Object.fromEntries(MACRO_FIELDS.map((field) => [field, 0])),
		micros: Object.fromEntries(MICRO_FIELDS.map((field) => [field, 0])),
		vitamins: Object.fromEntries(VITAMIN_FIELDS.map((field) => [field, 0])),
	};
	if (!Array.isArray(notes) || notes.length === 0) return totals;
	notes.forEach((note) => {
		if (!note || note.dateKey !== dateKey) return;
		MACRO_FIELDS.forEach((field) => {
			const value = Number(note.calorieEntry?.macros?.[field]);
			if (Number.isFinite(value)) totals.macros[field] += value;
		});
		MICRO_FIELDS.forEach((field) => {
			const value = Number(note.calorieEntry?.micros?.[field]);
			if (Number.isFinite(value)) totals.micros[field] += value;
		});
		VITAMIN_FIELDS.forEach((field) => {
			const value = Number(note.calorieEntry?.vitamins?.[field]);
			if (Number.isFinite(value)) totals.vitamins[field] += value;
		});
	});
	return totals;
}

function formatNutrientValue(value, unit) {
	if (!Number.isFinite(value)) return `0 ${unit}`;
	const normalized =
		value < NUTRIENT_DECIMAL_THRESHOLD
			? Math.round(value * 10) / 10
			: Math.round(value);
	return `${NUTRIENT_NUMBER_FORMAT.format(normalized)} ${unit}`;
}

function formatNutritionInlineSummary(dateKey = formatDateKey(new Date())) {
	const totals = getNoteNutritionTotalsForDateKey(dateKey);
	const bits = NUTRIENT_TRACKER_DEFINITIONS.map(
		({ shortLabel, group, key, unit }) => [
			shortLabel,
			totals[group]?.[key],
			unit,
		],
	)
		.filter(([, value]) => Number.isFinite(value) && value > 0)
		.map(
			([label, value, unit]) => `${label} ${formatNutrientValue(value, unit)}`,
		);
	return bits.length ? bits.join(UI_BULLET_SEPARATOR) : "";
}

function renderNutritionTracker() {
	const dateKey = getCalorieDisplayDateKey();
	const totals = getNoteNutritionTotalsForDateKey(dateKey);
	const settings = getCalorieSettings();
	const goals = normalizeNutrientGoalSettings(settings.nutrientGoals);
	const summaryEl = $("nutrition-summary");
	if (!summaryEl) return;

	NUTRIENT_TRACKER_DEFINITIONS.forEach(({ key, group, unit }) => {
		const idKey = key.replace(/([A-Z])/g, "-$1").toLowerCase();
		const valueEl = $(`nutrition-${idKey}-value`);
		const goalEl = $(`nutrition-${idKey}-goal`);
		if (valueEl)
			valueEl.textContent = formatNutrientValue(totals[group]?.[key], unit);
		if (goalEl) {
			const goalValue = goals[group]?.[key];
			goalEl.textContent = Number.isFinite(goalValue)
				? `Goal ${formatNutrientValue(goalValue, unit)}`
				: `Goal ${UI_EM_DASH}`;
		}
	});

	const hasAnyNutrition = hasAnyNutrientValue(
		totals.macros,
		totals.micros,
		totals.vitamins,
		{
			positiveOnly: true,
		},
	);
	const hasAnyGoal = hasAnyNutrientValue(
		goals.macros,
		goals.micros,
		goals.vitamins,
		{
			positiveOnly: true,
		},
	);
	summaryEl.textContent = hasAnyNutrition
		? hasAnyGoal
			? "Based on meal notes for the selected day. Goal progress shown per tracker."
			: "Based on meal notes for the selected day. Add daily nutrient goals in the Daily target panel."
		: "Log a meal note to start tracking macros, vitamins, and minerals.";
}

function getEffectiveCalorieConsumed(dateKey = getCalorieDisplayDateKey()) {
	const todayKey = formatDateKey(new Date());
	const baseConsumed = dateKey === todayKey ? getCalorieConsumed() : 0;
	return baseConsumed + getNoteCaloriesForDateKey(dateKey);
}

function getCalorieView() {
	const view = getCalorieSettings().view;
	return CALORIE_VIEWS.some((v) => v.id === view) ? view : "total";
}

function getCalorieRemaining(consumed = getEffectiveCalorieConsumed()) {
	const target = getCalorieTarget();
	if (!target) return null;
	return Math.max(0, target - consumed);
}

function formatCalories(value) {
	if (!Number.isFinite(value)) return "0";
	return new Intl.NumberFormat().format(Math.round(value));
}

function renderCalorieSummary() {
	const summary = $("calorie-summary");
	if (!summary) return;
	const target = getCalorieTarget();
	const dateKey = getCalorieDisplayDateKey();
	const consumed = getEffectiveCalorieConsumed(dateKey);
	const nutritionSummary = formatNutritionInlineSummary(dateKey);
	if (!target) {
		summary.textContent = nutritionSummary
			? `Set a target to track remaining calories${UI_BULLET_SEPARATOR}${nutritionSummary}`
			: "Set a target to track remaining calories.";
		return;
	}
	const remaining = Math.max(0, target - consumed);
	summary.textContent = nutritionSummary
		? `${formatCalories(remaining)} calories left today${UI_BULLET_SEPARATOR}${nutritionSummary}`
		: `${formatCalories(remaining)} calories left today.`;
}

function renderCalorieRing() {
	const ring = $("calorie-progress-ring");
	const valueEl = $("calorie-ring-value");
	const labelEl = $("calorie-ring-label");
	const detailEl = $("calorie-ring-detail");
	if (!ring || !valueEl || !labelEl || !detailEl) return;

	ring.setAttribute("stroke-dasharray", String(RING_CIRC));

	const target = getCalorieTarget();
	const dateKey = getCalorieDisplayDateKey();
	const consumed = getEffectiveCalorieConsumed(dateKey);
	const remaining = getCalorieRemaining(consumed);
	const view = getCalorieView();
	const viewLabel = CALORIE_VIEWS.find((v) => v.id === view)?.label ?? "Total";

	let value = 0;
	let progress = 0;
	let labelText = viewLabel;
	let detailText = "Set a daily target to track progress.";

	if (!target) {
		labelText = "No target set";
		value = 0;
		progress = 0;
	} else {
		if (view === "total") {
			value = target;
			progress = Math.min(consumed / target, 1);
			detailText = `${formatCalories(consumed)} consumed of ${formatCalories(target)}.`;
		} else if (view === "consumed") {
			value = consumed;
			progress = Math.min(consumed / target, 1);
			detailText = `${formatCalories(consumed)} of ${formatCalories(target)} consumed.`;
		} else {
			value = remaining ?? 0;
			progress = remaining !== null ? Math.min(remaining / target, 1) : 0;
			detailText = `${formatCalories(remaining ?? 0)} left of ${formatCalories(target)}.`;
		}
	}

	valueEl.textContent = formatCalories(value);
	labelEl.textContent = labelText;
	detailEl.textContent = detailText;
	ring.setAttribute("stroke-dashoffset", String(RING_CIRC * (1 - progress)));

	renderCalorieTipOrbs();
}

function getCalorieTipBucket() {
	const goalId = String(getCalorieSettings().goal || "").trim();
	if (!goalId) return null;
	return CALORIE_TIPS.map[goalId] || null;
}

function renderCalorieTipOrbs() {
	const layer = $("calorie-ring-emoji-layer");
	const panel = $("calorie-tip-panel");
	const panelTitle = $("calorie-tip-title");
	const panelDetail = $("calorie-tip-detail");
	if (!layer) return;

	const isEnabled = state.settings.showRingEmojis !== false;
	if (!isEnabled) {
		layer.classList.add("hidden");
		if (panel) panel.classList.add("hidden");
		return;
	}

	layer.classList.remove("hidden");
	if (panel) panel.classList.remove("hidden");

	const goalId = String(getCalorieSettings().goal || "").trim();
	const bucket = getCalorieTipBucket();
	const size = layer.clientWidth;

	if (!goalId || !bucket || bucket.tips.length === 0 || !size) {
		layer.innerHTML = "";
		calorieTipGoalId = goalId;
		calorieTipLayoutSize = size;
		calorieTipSelectionKey = null;
		if (panelTitle)
			panelTitle.textContent = goalId
				? "No tips yet"
				: "Select a goal to see calorie tips";
		if (panelDetail)
			panelDetail.textContent = goalId
				? "Add tips for this goal in calorie-tips.yaml."
				: "";
		return;
	}

	const shouldRender =
		!layer.childElementCount ||
		calorieTipGoalId !== goalId ||
		calorieTipLayoutSize !== size;

	if (shouldRender) {
		renderCalorieTipLayout(bucket, size, goalId);
	} else {
		updateCalorieTipSelectionStyles();
	}
}

function renderCalorieTipLayout(bucket, size, goalId) {
	const layer = $("calorie-ring-emoji-layer");
	const panelTitle = $("calorie-tip-title");
	const panelDetail = $("calorie-tip-detail");
	if (!layer || !panelTitle || !panelDetail) return;

	calorieTipGoalId = goalId;
	calorieTipLayoutSize = size;
	layer.innerHTML = "";

	const tips = bucket.tips;
	const radius = Math.max(size / 2 - 18, 0);
	const center = size / 2;
	const step = 360 / tips.length;

	tips.forEach((tip, index) => {
		const angle = step * index - 90;
		const rad = angle * (Math.PI / 180);
		const btn = document.createElement("button");
		btn.type = "button";
		btn.className = "ring-emoji-btn";
		btn.textContent = tip.emoji;
		btn.style.left = `${center + Math.cos(rad) * radius}px`;
		btn.style.top = `${center + Math.sin(rad) * radius}px`;
		btn.dataset.tipKey = `${goalId}-${index}`;
		btn.addEventListener("click", () => selectCalorieTip(goalId, index, tip));
		layer.appendChild(btn);
	});

	const hasSelection = tips.some(
		(_, index) => `${goalId}-${index}` === calorieTipSelectionKey,
	);
	if (!hasSelection) {
		calorieTipSelectionKey = null;
	}

	if (calorieTipSelectionKey) {
		const index = Number(calorieTipSelectionKey.split("-")[1]);
		const selectedTip = tips[index];
		if (selectedTip) {
			updateCalorieTipPanel(bucket, selectedTip);
		} else {
			updateCalorieTipPanel(bucket, null);
		}
	} else {
		updateCalorieTipPanel(bucket, null);
	}

	updateCalorieTipSelectionStyles();
}

function selectCalorieTip(goalId, index, tip) {
	calorieTipSelectionKey = `${goalId}-${index}`;
	updateCalorieTipPanel(getCalorieTipBucket(), tip);
	updateCalorieTipSelectionStyles();
}

function updateCalorieTipPanel(bucket, tip) {
	const panelTitle = $("calorie-tip-title");
	const panelDetail = $("calorie-tip-detail");
	if (!panelTitle || !panelDetail) return;

	if (!bucket || !tip) {
		panelTitle.textContent = "Tap a calorie orb for a tip";
		panelDetail.textContent = bucket
			? `${bucket.label} tips wrap the ring.`
			: "";
		return;
	}

	panelTitle.textContent = tip.title;
	panelDetail.textContent = tip.detail;
}

function updateCalorieTipSelectionStyles() {
	const layer = $("calorie-ring-emoji-layer");
	if (!layer) return;
	layer.querySelectorAll(".ring-emoji-btn").forEach((btn) => {
		const key = btn.dataset.tipKey;
		if (key === calorieTipSelectionKey) btn.classList.add("is-selected");
		else btn.classList.remove("is-selected");
	});
}

function renderFastButton() {
	const button = $("fast-btn");
	const modeLabel = $("fast-label-mode");
	const valueLabel = $("fast-label-value");
	if (!button || !modeLabel || !valueLabel) return;

	const mode = $("timer-mode");
	const main = $("timer-main");
	modeLabel.textContent = mode?.textContent || "Fast";
	valueLabel.textContent = main?.textContent || "00:00:00";
	button.setAttribute("aria-pressed", String(currentTab === "timer"));
}

function renderCalorieButton() {
	const button = $("calorie-btn");
	const modeLabel = $("calorie-label-mode");
	const valueLabel = $("calorie-label-value");
	if (!button || !modeLabel || !valueLabel) return;

	const target = getCalorieTarget();
	const dateKey = getCalorieDisplayDateKey();
	const consumed = getEffectiveCalorieConsumed(dateKey);
	const remaining = getCalorieRemaining(consumed);
	const view = getCalorieView();
	const viewLabel = CALORIE_VIEWS.find((v) => v.id === view)?.label ?? "Total";
	const isMissingConfig = !target;

	let valueText = "Set target";
	if (!isMissingConfig) {
		let value = 0;
		if (view === "total") value = target;
		else if (view === "consumed") value = consumed;
		else value = remaining ?? 0;
		valueText = `${formatCalories(value)} cal`;
	}

	modeLabel.textContent = viewLabel;
	valueLabel.textContent = valueText;
	button.setAttribute("aria-pressed", String(currentTab === "calories"));

	button.classList.toggle("danger-glow", isMissingConfig);
}

function renderCalories() {
	const targetInput = $("calorie-daily-target-input");
	const consumedInput = $("calorie-consumed-input");
	const goalInput = $("calorie-goal-input");
	const genderInput = $("calorie-gender-input");
	const fitnessInput = $("calorie-fitness-input");
	const ageInput = $("calorie-age-input");
	const heightInput = $("calorie-height-input");
	const heightMetricWrap = $("calorie-height-metric-wrap");
	const heightImperialWrap = $("calorie-height-imperial-wrap");
	const heightFeetSelect = $("calorie-height-feet-select");
	const heightInchesSelect = $("calorie-height-inches-select");
	const weightInput = $("calorie-weight-input");
	const heightLabel = $("calorie-height-label");
	const weightLabel = $("calorie-weight-label");
	const heightSubtext = $("calorie-height-subtext");
	const weightSubtext = $("calorie-weight-subtext");
	const settings = getCalorieSettings();
	const nutrientGoals = normalizeNutrientGoalSettings(settings.nutrientGoals);
	const unitSystem = getCalorieUnitSystem();
	ensureHeightSelectorsPopulated();
	if (targetInput) {
		const target = getCalorieTarget();
		targetInput.value = target ? String(Math.round(target)) : "";
	}
	if (consumedInput) {
		const consumed = getCalorieConsumed();
		consumedInput.value = consumed ? String(Math.round(consumed)) : "";
	}
	if (goalInput) goalInput.value = normalizeCalorieGoalId(settings.goal);
	if (genderInput) genderInput.value = settings.gender || "";
	if (fitnessInput) fitnessInput.value = settings.fitnessLevel || "";
	if (ageInput) {
		const age = normalizeGoalMetric(settings.age);
		ageInput.value = age ? String(age) : "";
	}
	const height = normalizeGoalMetric(settings.height);
	if (unitSystem === "imperial") {
		if (heightMetricWrap) heightMetricWrap.classList.add("hidden");
		if (heightImperialWrap) heightImperialWrap.classList.remove("hidden");
		const imperialHeight = normalizeImperialHeight(height);
		if (heightFeetSelect) heightFeetSelect.value = String(imperialHeight.feet);
		if (heightInchesSelect)
			heightInchesSelect.value = String(imperialHeight.inches);
	} else {
		if (heightMetricWrap) heightMetricWrap.classList.remove("hidden");
		if (heightImperialWrap) heightImperialWrap.classList.add("hidden");
		if (heightInput) {
			heightInput.value = height ? String(height) : "";
		}
	}
	if (weightInput) {
		const weight = normalizeGoalMetric(settings.currentWeight);
		weightInput.value = weight ? String(weight) : "";
	}
	NUTRIENT_GOAL_INPUT_FIELDS.forEach(({ id, group, key }) => {
		const input = $(id);
		if (!input) return;
		const value = nutrientGoals[group]?.[key];
		input.value = Number.isFinite(value) ? String(value) : "";
	});
	if (heightLabel) {
		heightLabel.textContent =
			unitSystem === "imperial" ? "Height (ft/in)" : "Height (cm)";
	}
	if (weightLabel) {
		weightLabel.textContent =
			unitSystem === "imperial" ? "Current weight (lb)" : "Current weight (kg)";
	}
	if (heightInput) {
		heightInput.placeholder =
			unitSystem === "imperial" ? "e.g. 5'8\"" : "e.g. 170 cm";
	}
	if (weightInput) {
		weightInput.placeholder =
			unitSystem === "imperial" ? "e.g. 160 lb" : "e.g. 72.5 kg";
	}
	if (heightSubtext) {
		heightSubtext.textContent =
			unitSystem === "imperial"
				? "Select height in feet and inches."
				: "Height in centimeters.";
	}
	if (weightSubtext) {
		weightSubtext.textContent =
			unitSystem === "imperial"
				? "Current weight in pounds."
				: "Current weight in kilograms.";
	}
	renderCalorieSummary();
	renderCalorieRing();
	renderCalorieButton();
	renderNutritionTracker();
}

function initCalories() {
	const targetInput = $("calorie-daily-target-input");
	const consumedInput = $("calorie-consumed-input");
	const goalInput = $("calorie-goal-input");
	const genderInput = $("calorie-gender-input");
	const fitnessInput = $("calorie-fitness-input");
	const ageInput = $("calorie-age-input");
	const heightInput = $("calorie-height-input");
	const heightFeetSelect = $("calorie-height-feet-select");
	const heightInchesSelect = $("calorie-height-inches-select");
	const weightInput = $("calorie-weight-input");
	const ringValue = $("calorie-ring-value");
	ensureHeightSelectorsPopulated();

	if (targetInput) {
		targetInput.addEventListener("input", (event) => {
			const next = parseCalorieValue(event.target.value);
			const settings = getCalorieSettings();
			setCalorieTargetSettings(settings, next);
			void saveState();
			renderCalories();
		});
	}

	if (consumedInput) {
		consumedInput.addEventListener("input", (event) => {
			const next = parseCalorieValue(event.target.value);
			const settings = getCalorieSettings();
			settings.consumed = next ?? 0;
			void saveState();
			renderCalories();
		});
	}

	if (goalInput) {
		goalInput.addEventListener("change", (event) => {
			const settings = getCalorieSettings();
			settings.goal = normalizeCalorieGoalId(event.target.value);
			void saveState();
			renderCalories();
		});
	}

	if (genderInput) {
		genderInput.addEventListener("change", (event) => {
			const settings = getCalorieSettings();
			settings.gender = event.target.value || "";
			void saveState();
			renderCalories();
		});
	}

	if (fitnessInput) {
		fitnessInput.addEventListener("change", (event) => {
			const settings = getCalorieSettings();
			settings.fitnessLevel = event.target.value || "";
			void saveState();
			renderCalories();
		});
	}

	if (ageInput) {
		ageInput.addEventListener("input", (event) => {
			const next = parseCalorieValue(event.target.value);
			const settings = getCalorieSettings();
			settings.age = next;
			void saveState();
			renderCalories();
		});
	}

	if (heightInput) {
		heightInput.addEventListener("input", (event) => {
			const next = parseCalorieValue(event.target.value);
			const settings = getCalorieSettings();
			settings.height = next;
			void saveState();
			renderCalories();
		});
	}

	const onImperialHeightChange = () => {
		const settings = getCalorieSettings();
		settings.height = getHeightFromImperialSelectors();
		void saveState();
		renderCalories();
	};
	if (heightFeetSelect) {
		heightFeetSelect.addEventListener("change", onImperialHeightChange);
	}
	if (heightInchesSelect) {
		heightInchesSelect.addEventListener("change", onImperialHeightChange);
	}

	if (weightInput) {
		weightInput.addEventListener("input", (event) => {
			const next = parseCalorieValue(event.target.value);
			const settings = getCalorieSettings();
			settings.currentWeight = next;
			void saveState();
			renderCalories();
		});
	}

	NUTRIENT_GOAL_INPUT_FIELDS.forEach(({ id, group, key }) => {
		const input = $(id);
		if (!input) return;
		input.addEventListener("input", (event) => {
			const next = parseCalorieValue(event.target.value);
			const settings = getCalorieSettings();
			const nutrientGoals = normalizeNutrientGoalSettings(
				settings.nutrientGoals,
			);
			nutrientGoals[group][key] = next;
			settings.nutrientGoals = nutrientGoals;
			void saveState();
			renderCalories();
		});
	});

	if (ringValue) {
		ringValue.addEventListener("click", () => {
			const current = getCalorieView();
			const index = CALORIE_VIEWS.findIndex((view) => view.id === current);
			const next =
				CALORIE_VIEWS[(index + 1) % CALORIE_VIEWS.length]?.id ?? "total";
			const settings = getCalorieSettings();
			settings.view = next;
			void saveState();
			renderCalories();
		});
	}
}

function initFastTypeChips() {
	const container = $("fast-type-chips");
	container.innerHTML = "";
	FAST_TYPES.forEach((type) => {
		const btn = document.createElement("button");
		btn.type = "button";
		btn.dataset.typeId = type.id;
		btn.className = "fast-type-chip text-[11px] md:text-[10px]";
		btn.textContent = type.label;
		btn.addEventListener("click", () => {
			pendingTypeId = type.id;
			openFastTypeModal(getTypeById(pendingTypeId));
		});
		container.appendChild(btn);
	});
	highlightSelectedFastType();
}

function highlightSelectedFastType() {
	const chips = document.querySelectorAll("#fast-type-chips button");
	const current = state.activeFast
		? state.activeFast.typeId
		: selectedFastTypeId;
	chips.forEach((chip) => {
		const isActive = chip.dataset.typeId === current;
		if (isActive) {
			chip.classList.add("fast-type-chip--active");
		} else {
			chip.classList.remove("fast-type-chip--active");
		}
	});
}

function applyTypeToActiveFast(typeId) {
	const af = state.activeFast;
	if (!af) return;
	const t = getTypeById(typeId);
	af.typeId = t.id;
	af.plannedDurationHours = t.durationHours;
	af.endTimestamp = af.startTimestamp + t.durationHours * 3600000;
	af.status = "active";
	state.reminders = { endNotified: false, lastHourlyAt: null };
}

function openFastTypeModal(type) {
	$("modal-type-label").textContent = `${type.label} fast`;
	$("modal-type-duration").textContent =
		type.useCase || `${type.durationHours} hours`;
	$("fast-type-modal").classList.remove("hidden");
}

function closeFastTypeModal() {
	$("fast-type-modal").classList.add("hidden");
	pendingTypeId = null;
}

function usePendingFastType() {
	if (!pendingTypeId) {
		closeFastTypeModal();
		return;
	}
	selectedFastTypeId = pendingTypeId;
	state.settings.defaultFastTypeId = selectedFastTypeId;
	if (state.activeFast) applyTypeToActiveFast(selectedFastTypeId);
	void saveState();
	closeFastTypeModal();
	highlightSelectedFastType();
	updateTimer();
	if (!state.activeFast) renderTimerMetaIdle();
	showToast("Fast type applied");
}

function parseEstimatedNutritionValue(value) {
	if (value === null || value === undefined) return null;
	const parsed = Number(value);
	if (!Number.isFinite(parsed) || parsed < 0) return null;
	return parsed;
}

function normalizeCalorieGoalId(value) {
	const normalized = String(value || "")
		.trim()
		.toLowerCase();
	return VALID_CALORIE_GOALS.has(normalized) ? normalized : "";
}

function normalizeAIEstimatedNutrition(payload) {
	const calories = parseEstimatedNutritionValue(payload?.calories);
	const macros = {
		protein: parseEstimatedNutritionValue(payload?.macros?.protein),
		carbs: parseEstimatedNutritionValue(payload?.macros?.carbs),
		fat: parseEstimatedNutritionValue(payload?.macros?.fat),
	};
	const micros = {
		sodium: parseEstimatedNutritionValue(payload?.micros?.sodium),
		potassium: parseEstimatedNutritionValue(payload?.micros?.potassium),
		calcium: parseEstimatedNutritionValue(payload?.micros?.calcium),
		iron: parseEstimatedNutritionValue(payload?.micros?.iron),
		magnesium: parseEstimatedNutritionValue(payload?.micros?.magnesium),
		zinc: parseEstimatedNutritionValue(payload?.micros?.zinc),
	};
	const vitamins = {
		vitaminA: parseEstimatedNutritionValue(payload?.vitamins?.vitaminA),
		vitaminC: parseEstimatedNutritionValue(payload?.vitamins?.vitaminC),
		vitaminD: parseEstimatedNutritionValue(payload?.vitamins?.vitaminD),
		vitaminB6: parseEstimatedNutritionValue(payload?.vitamins?.vitaminB6),
		vitaminB12: parseEstimatedNutritionValue(payload?.vitamins?.vitaminB12),
	};
	const hasNutrition = hasAnyNutrientValue(macros, micros, vitamins);
	if (calories === null && !hasNutrition) return null;
	return { calories, macros, micros, vitamins };
}

function normalizeAIRecommendedPlan(payload) {
	if (!payload || typeof payload !== "object") return null;
	const dailyTarget = parseEstimatedNutritionValue(
		payload.dailyTarget ?? payload.dailyCalories,
	);
	const goal = normalizeCalorieGoalId(payload.goal ?? payload.primaryGoal);
	const nutrientGoals = normalizeNutrientGoalSettings(payload.nutrientGoals);
	const hasGoal =
		dailyTarget !== null ||
		Boolean(goal) ||
		hasAnyNutrientValue(
			nutrientGoals.macros,
			nutrientGoals.micros,
			nutrientGoals.vitamins,
			{
				positiveOnly: true,
			},
		);
	if (!hasGoal) return null;
	return {
		dailyTarget,
		goal,
		nutrientGoals,
	};
}

function parseAIJsonPayload(text) {
	const trimmed = text?.trim();
	if (!trimmed) return null;
	const withoutFence = trimmed
		.replace(/^```(?:json)?\s*/i, "")
		.replace(/\s*```$/, "")
		.trim();
	try {
		return JSON.parse(withoutFence);
	} catch {}
	const objectMatch = withoutFence.match(/\{[\s\S]*\}/);
	if (!objectMatch) return null;
	try {
		return JSON.parse(objectMatch[0]);
	} catch {
		return null;
	}
}

function normalizeOpenAIModel(value) {
	const normalized = String(value || "")
		.trim()
		.toLowerCase();
	return OPENAI_ALLOWED_MODELS.includes(normalized)
		? normalized
		: DEFAULT_OPENAI_MODEL;
}

/**
 * Normalize a persisted/provider input value to a supported LLM provider id.
 * Returns the default provider when the input is missing or unsupported.
 * @param {unknown} value
 * @returns {string}
 */
function normalizeLLMProvider(value) {
	const normalized = String(value || "")
		.trim()
		.toLowerCase();
	return SUPPORTED_LLM_PROVIDERS.has(normalized)
		? normalized
		: DEFAULT_LLM_PROVIDER;
}

function normalizeOpenAIReasoningEffort(value) {
	if (!value) return "none";
	const next = String(value || "")
		.trim()
		.toLowerCase();
	return OPENAI_REASONING_EFFORTS.has(next) ? next : "none";
}

const OPENAI_NOTES_RANGE_LABELS = [
	"No notes",
	"Last note",
	"Last 2 notes",
	"Last 3 notes",
	"Last 4 notes",
	"Last 5 notes",
	"Last 6 notes",
	"Last 7 notes",
	"Last 8 notes",
	"Last 9 notes",
	"Last 10 notes",
	"Today's notes",
	"This week's notes",
	"This month's notes",
	"Last 2 months",
	"Last 3 months",
	"Last 6 months",
	"Last 1 year",
	"All notes",
];
const OPENAI_NOTES_RANGE_MAX = OPENAI_NOTES_RANGE_LABELS.length - 1;
const OPENAI_NOTES_LAST_COUNT_MAX = 10;
const OPENAI_NOTES_TODAY_RANGE = 11;
const OPENAI_NOTES_WEEK_RANGE = 12;
const OPENAI_NOTES_MONTH_RANGE = 13;
const OPENAI_NOTES_TWO_MONTHS_RANGE = 14;
const OPENAI_NOTES_THREE_MONTHS_RANGE = 15;
const OPENAI_NOTES_SIX_MONTHS_RANGE = 16;
const OPENAI_NOTES_YEAR_RANGE = 17;
const AI_TRAINER_NOTE_PROMPT = [
	"You are the user's expert trainer and nutrition coach: practical, supportive, observant, and forward-looking.",
	"Write a concise markdown trainer note with constructive personal feedback.",
	"Use previous AI trainer notes as continuity, comparing what changed since earlier recommendations and calling out meaningful differences.",
	"Focus on actionable next steps for nutrition, fasting routine, exercise, and recovery, while helping the user think through tradeoffs and next goals.",
	"Use the current fast status, selected fasting schedule, completed fasts, nutrition context, and journal notes together.",
	"Respect user instructions, dietary needs, injuries, and limitations.",
	"Keep output light and actionable: max 4 short markdown bullets or short sections, no fluff.",
	"If information is missing, give safe, realistic suggestions and mention uncertainty briefly.",
].join(" ");
const AI_TRAINER_QUICK_QUESTION_PROMPT = [
	"You are the user's expert trainer and nutrition coach.",
	"Answer the user's quick question in exactly one clear paragraph.",
	"Keep the response practical, supportive, and specific to the user's fasting and nutrition context.",
	"Do not use markdown lists, headings, or multiple paragraphs.",
].join(" ");
const AI_TRAINER_NOTE_TITLE = "AI Trainer Note";
const AI_TRAINER_NOTE_HEADING = "{ðŸ¤– TRAINER}";
const AI_TRAINER_NOTE_SOURCE = "ai_trainer";
const AI_TRAINER_NOTE_MARKER = "ai:trainer-note";
const AI_TRAINER_QUICK_NOTE_TEXT_TEMPLATE =
	"You asked: {question} — Trainer replied: {response}";
const TRAINER_QUICK_QUESTION_MAX_CHARS = 500;
const TRAINER_QUICK_RESPONSE_MAX_CHARS = 700;
// Stored as "prefix + JSON" so future parser versions can migrate safely.
const TRAINER_NOTE_CONVERSATION_STORAGE_PREFIX = "trainer-chat:v1:";
const TRAINER_NOTE_CONVERSATION_MAX_CHARS = 500;
const AI_TRAINER_NOTE_CONVERSATION_PROMPT = [
	"You are continuing an existing trainer conversation about one specific core note.",
	"Treat coreNote as the main topic and keep all other app context as supporting context only.",
	"Reply as the trainer in exactly one clear paragraph with practical next steps.",
	"Be supportive and specific to fasting, nutrition, training, and recovery context when relevant.",
	"Do not use markdown lists, headings, or multiple paragraphs.",
].join(" ");
const AI_TRAINER_NOTE_TAGS = Object.freeze([
	"ai",
	"trainer",
	"ai_trainer",
	"trainer_note",
]);
const TRAINER_NOTE_FILTERS = Object.freeze({
	trainer: {
		id: "trainer",
		group: "source",
		label: "TRAINER NOTE",
		matches: (note) => isAITrainerNote(note),
	},
	user: {
		id: "user",
		group: "source",
		label: "USER NOTE",
		matches: (note) => !isAITrainerNote(note),
	},
	fast: {
		id: "fast",
		group: "context",
		label: "FAST NOTES",
		matches: (note) => Boolean(note.fastContext?.wasActive),
	},
	nofast: {
		id: "nofast",
		group: "context",
		label: "NO-FAST NOTES",
		matches: (note) => !note.fastContext?.wasActive,
	},
});
const TRAINER_NOTE_FILTER_GROUPS = Object.freeze(["source", "context"]);

function normalizeOpenAINotesRange(value) {
	const n = Number(value);
	if (!Number.isFinite(n) || n < 0) return 0;
	return Math.min(Math.round(n), OPENAI_NOTES_RANGE_MAX);
}

function normalizeTrainerNoteFilters(value) {
	const raw = Array.isArray(value) ? value : [];
	return raw.filter(
		(id, index) => TRAINER_NOTE_FILTERS[id] && raw.indexOf(id) === index,
	);
}

function getAITrainerNoteFilters() {
	return normalizeTrainerNoteFilters(aiTrainerNoteFilterOverride);
}

function setAITrainerNoteFilters(filters) {
	aiTrainerNoteFilterOverride = normalizeTrainerNoteFilters(filters);
	renderAITrainerNoteFilters();
	renderNotesTab();
}

function toggleAITrainerNoteFilter(filterId) {
	if (!TRAINER_NOTE_FILTERS[filterId]) return;
	const selected = new Set(getAITrainerNoteFilters());
	if (selected.has(filterId)) {
		selected.delete(filterId);
	} else {
		selected.add(filterId);
	}
	setAITrainerNoteFilters([...selected]);
}

function noteMatchesTrainerFilters(note, filters = getAITrainerNoteFilters()) {
	const normalizedFilters = normalizeTrainerNoteFilters(filters);
	if (!normalizedFilters.length) return true;
	return TRAINER_NOTE_FILTER_GROUPS.every((group) => {
		const groupFilters = normalizedFilters.filter(
			(filterId) => TRAINER_NOTE_FILTERS[filterId]?.group === group,
		);
		if (!groupFilters.length) return true;
		return groupFilters.some((filterId) =>
			TRAINER_NOTE_FILTERS[filterId].matches(note),
		);
	});
}

function getTrainerNoteFilterSummary(filters = getAITrainerNoteFilters()) {
	const normalizedFilters = normalizeTrainerNoteFilters(filters);
	if (!normalizedFilters.length)
		return "No filters selected. Trainer can use every note in range.";
	const labels = normalizedFilters.map(
		(filterId) => TRAINER_NOTE_FILTERS[filterId].label,
	);
	return `Using ${labels.join(", ").toLowerCase()} from the selected range.`;
}

function getGlobalTrainerContextRange(providerOverride = null) {
	const provider = normalizeLLMProvider(
		providerOverride === null ? state.settings.llmProvider : providerOverride,
	);
	return provider === "byo"
		? normalizeOpenAINotesRange(state.settings.byoLlm?.notesRange)
		: normalizeOpenAINotesRange(state.settings.openaiNotesRange);
}

function getAITrainerProviderOverride() {
	return aiTrainerProviderOverride === null
		? normalizeLLMProvider(state.settings.llmProvider)
		: normalizeLLMProvider(aiTrainerProviderOverride);
}

function getTrainerContextRange(providerOverride = null) {
	return getGlobalTrainerContextRange(providerOverride);
}

function getAITrainerNotesRangeOverride() {
	return aiTrainerNotesRangeOverride === null
		? getGlobalTrainerContextRange(getAITrainerProviderOverride())
		: normalizeOpenAINotesRange(aiTrainerNotesRangeOverride);
}

function seedAITrainerNotesRangeOverride() {
	aiTrainerNotesRangeOverride = getGlobalTrainerContextRange(
		getAITrainerProviderOverride(),
	);
	renderAITrainerNotesRangeOverride();
}

function clearAITrainerNotesRangeOverride() {
	aiTrainerNotesRangeOverride = null;
	aiTrainerProviderOverride = null;
}

function normalizeSingleParagraph(value, maxChars) {
	const maxLength = Number.isFinite(maxChars) ? Math.max(1, maxChars) : 500;
	const collapsed = String(value || "")
		.replace(/\r\n/g, "\n")
		.replace(/\n+/g, " ")
		.replace(/\s+/g, " ")
		.trim();
	if (!collapsed) return "";
	if (collapsed.length <= maxLength) return collapsed;
	return collapsed.slice(0, maxLength).trimEnd();
}

function pluralize(count, singular, pluralWord = `${singular}s`) {
	return Number(count) === 1 ? singular : pluralWord;
}

function normalizeTrainerConversationMessageRole(role) {
	return role === "trainer" ? "trainer" : "user";
}

function normalizeTrainerConversationMessages(messages) {
	if (!Array.isArray(messages)) return [];
	return messages
		.map((message) => ({
			role: normalizeTrainerConversationMessageRole(message?.role),
			content: normalizeSingleParagraph(
				message?.content,
				TRAINER_NOTE_CONVERSATION_MAX_CHARS,
			),
		}))
		.filter((message) => Boolean(message.content));
}

function parseTrainerConversationMessages(value) {
	const raw = String(value || "").trim();
	if (!raw) return [];
	if (raw.startsWith(TRAINER_NOTE_CONVERSATION_STORAGE_PREFIX)) {
		const serialized = raw.slice(
			TRAINER_NOTE_CONVERSATION_STORAGE_PREFIX.length,
		);
		try {
			const parsed = JSON.parse(serialized);
			return normalizeTrainerConversationMessages(parsed);
		} catch {}
	}
	return [
		{
			role: "user",
			content: normalizeSingleParagraph(
				raw,
				TRAINER_NOTE_CONVERSATION_MAX_CHARS,
			),
		},
	].filter((message) => Boolean(message.content));
}

function serializeTrainerConversationMessages(messages) {
	const normalized = normalizeTrainerConversationMessages(messages);
	if (!normalized.length) return "";
	return `${TRAINER_NOTE_CONVERSATION_STORAGE_PREFIX}${JSON.stringify(normalized)}`;
}

function formatTrainerConversationMessagesForContext(messages) {
	return normalizeTrainerConversationMessages(messages)
		.map((message) =>
			message.role === "trainer"
				? `Trainer: ${message.content}`
				: `User: ${message.content}`,
		)
		.join("\n");
}

function getTrainerRangeCutoff(range, now = Date.now()) {
	if (range === OPENAI_NOTES_TODAY_RANGE) {
		const d = new Date(now);
		return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
	}
	if (range === OPENAI_NOTES_WEEK_RANGE) return now - 7 * 24 * 60 * 60 * 1000;
	if (range === OPENAI_NOTES_MONTH_RANGE) {
		const d = new Date(now);
		return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
	}
	if (range === OPENAI_NOTES_TWO_MONTHS_RANGE) {
		const d = new Date(now);
		d.setMonth(d.getMonth() - 2);
		return d.getTime();
	}
	if (range === OPENAI_NOTES_THREE_MONTHS_RANGE) {
		const d = new Date(now);
		d.setMonth(d.getMonth() - 3);
		return d.getTime();
	}
	if (range === OPENAI_NOTES_SIX_MONTHS_RANGE) {
		const d = new Date(now);
		d.setMonth(d.getMonth() - 6);
		return d.getTime();
	}
	if (range === OPENAI_NOTES_YEAR_RANGE) {
		const d = new Date(now);
		d.setFullYear(d.getFullYear() - 1);
		return d.getTime();
	}
	return null;
}

function getNotesForTrainer(rangeOverride = null, filtersOverride = null) {
	const range =
		rangeOverride === null
			? getTrainerContextRange()
			: normalizeOpenAINotesRange(rangeOverride);
	if (range === 0 || !notes.length) return [];
	const filters =
		filtersOverride === null
			? getAITrainerNoteFilters()
			: normalizeTrainerNoteFilters(filtersOverride);
	const now = Date.now();
	const sorted = [...notes]
		.filter((note) => noteMatchesTrainerFilters(note, filters))
		.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
	if (range >= 1 && range <= OPENAI_NOTES_LAST_COUNT_MAX) {
		return sorted.slice(0, range);
	}
	if (range === OPENAI_NOTES_RANGE_MAX) return sorted;
	const cutoff = getTrainerRangeCutoff(range, now);
	if (cutoff === null) return sorted;
	return sorted.filter((n) => (n.createdAt || 0) >= cutoff);
}

function getFastsForTrainer(rangeOverride = null) {
	const range =
		rangeOverride === null
			? getTrainerContextRange()
			: normalizeOpenAINotesRange(rangeOverride);
	if (range === 0 || !state.history.length) return [];
	const sorted = [...state.history].sort(
		(a, b) =>
			(b.endTimestamp || b.startTimestamp || 0) -
			(a.endTimestamp || a.startTimestamp || 0),
	);
	if (range >= 1 && range <= OPENAI_NOTES_LAST_COUNT_MAX) {
		return sorted.slice(0, range);
	}
	if (range === OPENAI_NOTES_RANGE_MAX) return sorted;
	const cutoff = getTrainerRangeCutoff(range);
	if (cutoff === null) return sorted;
	return sorted.filter(
		(fast) => (fast.endTimestamp || fast.startTimestamp || 0) >= cutoff,
	);
}

function sanitizeBearerToken(value) {
	const token = String(value || "").trim();
	if (!token || /[\r\n]/.test(token)) return "";
	return token;
}

function normalizeByoLlmSettings(value) {
	const raw = value && typeof value === "object" ? value : {};
	const maxCompletionTokens = Number(raw.maxCompletionTokens);
	const temperature = Number(raw.temperature);
	return {
		apiUrl: String(raw.apiUrl || "").trim(),
		apiKey: sanitizeBearerToken(raw.apiKey),
		model: String(raw.model || "").trim(),
		reasoningEffort: normalizeOpenAIReasoningEffort(raw.reasoningEffort),
		maxCompletionTokens:
			Number.isFinite(maxCompletionTokens) && maxCompletionTokens > 0
				? Math.round(maxCompletionTokens)
				: OPENAI_MAX_TOKENS_WITH_REASONING,
		temperature:
			Number.isFinite(temperature) && temperature >= 0 && temperature <= 2
				? temperature
				: 1,
		headersJson:
			typeof raw.headersJson === "string" ? raw.headersJson.trim() : "",
		trainerInstructions:
			typeof raw.trainerInstructions === "string"
				? raw.trainerInstructions
				: "",
		notesRange: normalizeOpenAINotesRange(raw.notesRange),
	};
}

function parseByoLlmHeaders(headersText) {
	if (!headersText?.trim()) return {};
	try {
		const parsed = JSON.parse(headersText);
		if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
			return null;
		const headers = {};
		for (const [key, value] of Object.entries(parsed)) {
			const headerKey = String(key || "").trim();
			if (!headerKey || /[\r\n]/.test(headerKey)) continue;
			if (value === null || value === undefined) continue;
			const headerValue = String(value).trim();
			if (!headerValue || /[\r\n]/.test(headerValue)) continue;
			headers[headerKey] = headerValue;
		}
		return headers;
	} catch {
		return null;
	}
}

function getAIProviderSettings(providerOverride = null) {
	const provider = normalizeLLMProvider(
		providerOverride === null ? state.settings.llmProvider : providerOverride,
	);
	const byo = normalizeByoLlmSettings(state.settings.byoLlm);
	if (provider === "byo") {
		return {
			provider,
			apiUrl: byo.apiUrl,
			apiKey: byo.apiKey,
			model: byo.model,
			reasoningEffort: byo.reasoningEffort,
			maxCompletionTokens: byo.maxCompletionTokens,
			temperature: byo.temperature,
			headers: parseByoLlmHeaders(byo.headersJson),
		};
	}
	return {
		provider: "openai",
		apiUrl: "https://api.openai.com/v1/chat/completions",
		apiKey: sanitizeBearerToken(state.settings.openaiApiKey),
		model: normalizeOpenAIModel(state.settings.openaiModel),
		reasoningEffort: normalizeOpenAIReasoningEffort(
			state.settings.openaiReasoningEffort,
		),
		maxCompletionTokens: OPENAI_MAX_TOKENS_STANDARD,
		temperature: 1,
		headers: {},
	};
}

function getMaxCompletionTokens(config, usingReasoning) {
	if (!usingReasoning) return config.maxCompletionTokens;
	if (config.provider !== "openai") return config.maxCompletionTokens;
	return Math.max(config.maxCompletionTokens, OPENAI_MAX_TOKENS_WITH_REASONING);
}

function isAllowedOpenAIModel(modelId) {
	const normalized = String(modelId || "")
		.trim()
		.toLowerCase();
	return OPENAI_ALLOWED_MODELS.includes(normalized);
}

function supportsReasoningEffort(modelId) {
	return isAllowedOpenAIModel(modelId);
}

function compareOpenAIModelOptions(left, right) {
	const lowerLeft = left.toLowerCase();
	const lowerRight = right.toLowerCase();
	const leftIndex = OPENAI_ALLOWED_MODELS.indexOf(lowerLeft);
	const rightIndex = OPENAI_ALLOWED_MODELS.indexOf(lowerRight);
	const leftRank = leftIndex === -1 ? OPENAI_ALLOWED_MODELS.length : leftIndex;
	const rightRank =
		rightIndex === -1 ? OPENAI_ALLOWED_MODELS.length : rightIndex;
	if (leftRank !== rightRank) return leftRank - rightRank;
	return left.localeCompare(right, "en", {
		sensitivity: "base",
		numeric: true,
	});
}

function resetReasoningSupportToast() {
	reasoningSupportToastShown = false;
}

function showReasoningUnsupportedToastOnce() {
	if (reasoningSupportToastShown) return;
	showToast("Reasoning mode is not supported by the selected model");
	reasoningSupportToastShown = true;
}

function syncReasoningSettingForModel() {
	const reasoningSelect = $("openai-reasoning-effort");
	const selectedModel = normalizeOpenAIModel(state.settings.openaiModel);
	const supportsReasoning = supportsReasoningEffort(selectedModel);
	const currentReasoning = normalizeOpenAIReasoningEffort(
		state.settings.openaiReasoningEffort,
	);
	if (reasoningSelect) {
		reasoningSelect.disabled = !supportsReasoning;
		reasoningSelect.title = supportsReasoning
			? ""
			: "Reasoning mode is available only for compatible o-series models.";
	}
	if (!supportsReasoning && currentReasoning !== "none") {
		state.settings.openaiReasoningEffort = "none";
		if (reasoningSelect) reasoningSelect.value = "none";
		return true;
	}
	return false;
}

function renderOpenAIModelOptions() {
	const modelSelect = $("openai-model-select");
	if (!modelSelect) return;
	const selectedModel = normalizeOpenAIModel(state.settings.openaiModel);
	modelSelect.innerHTML = "";
	const models = openAIModelOptions.length
		? [...openAIModelOptions]
		: [...OPENAI_ALLOWED_MODELS];
	if (!models.includes(selectedModel)) models.unshift(selectedModel);
	models.forEach((modelId) => {
		const option = document.createElement("option");
		option.value = modelId;
		option.textContent = modelId;
		modelSelect.appendChild(option);
	});
	const fallbackModel = models[0] || DEFAULT_OPENAI_MODEL;
	const resolvedModel = models.includes(selectedModel)
		? selectedModel
		: fallbackModel;
	if (resolvedModel !== state.settings.openaiModel) {
		state.settings.openaiModel = resolvedModel;
		void saveState();
	}
	modelSelect.value = resolvedModel;
	modelSelect.disabled = false;
}

async function loadOpenAIModels(forceRefresh = false) {
	void forceRefresh;
	openAIModelOptions = [...OPENAI_ALLOWED_MODELS].sort(
		compareOpenAIModelOptions,
	);
	openAIModelsLoadedForKey = sanitizeBearerToken(state.settings.openaiApiKey);
	renderOpenAIModelOptions();
}

function buildGoalRecommendationProfile() {
	const settings = getCalorieSettings();
	const unitSystem = getCalorieUnitSystem();
	const height = normalizeGoalMetric(settings.height);
	const weight = normalizeGoalMetric(settings.currentWeight);
	const imperialHeight = normalizeImperialHeight(height);
	const heightLabel =
		unitSystem === "imperial"
			? `${imperialHeight.feet} ft ${imperialHeight.inches} in`
			: Number.isFinite(height) && height > 0
				? `${height} cm`
				: "";
	const weightLabel =
		unitSystem === "imperial"
			? Number.isFinite(weight) && weight > 0
				? `${weight} lb`
				: ""
			: Number.isFinite(weight) && weight > 0
				? `${weight} kg`
				: "";
	return {
		goal: normalizeCalorieGoalId(settings.goal),
		age: normalizeGoalMetric(settings.age),
		gender: settings.gender || "",
		fitnessLevel: settings.fitnessLevel || "",
		unitSystem,
		height: heightLabel,
		currentWeight: weightLabel,
		dailyTarget: getCalorieTarget(),
		nutrientGoals: normalizeNutrientGoalSettings(settings.nutrientGoals),
	};
}

function roundTrainerHours(value) {
	if (!Number.isFinite(value)) return null;
	return Math.round(value * 10) / 10;
}

function buildTrainerFastTypeSummary(type) {
	if (!type) return null;
	return {
		id: type.id,
		label: type.label,
		durationHours: type.durationHours,
		useCase: type.useCase || null,
		milestoneHours: Array.isArray(type.milestoneHours)
			? type.milestoneHours
			: [],
	};
}

function buildTrainerActiveFastContext() {
	const fastContext = buildFastContext();
	const activeFast = state.activeFast;
	const type = activeFast?.typeId ? getTypeById(activeFast.typeId) : null;
	const now = Date.now();
	if (!activeFast) {
		return {
			isCurrentlyFasting: false,
			context: fastContext,
		};
	}
	const plannedDurationHours =
		activeFast.plannedDurationHours ?? type?.durationHours ?? null;
	const elapsedHours =
		typeof activeFast.startTimestamp === "number"
			? (now - activeFast.startTimestamp) / 3600000
			: null;
	const remainingHours =
		Number.isFinite(plannedDurationHours) && Number.isFinite(elapsedHours)
			? plannedDurationHours - elapsedHours
			: null;
	const phaseHour = Number.isFinite(elapsedHours)
		? Math.floor(elapsedHours)
		: null;
	const phase = phaseHour !== null ? getHourlyEntry(phaseHour) : null;
	return {
		isCurrentlyFasting: true,
		context: fastContext,
		startedAt: activeFast.startTimestamp
			? new Date(activeFast.startTimestamp).toISOString()
			: null,
		plannedEndAt: activeFast.endTimestamp
			? new Date(activeFast.endTimestamp).toISOString()
			: null,
		fastType: buildTrainerFastTypeSummary(type),
		elapsedHours: roundTrainerHours(elapsedHours),
		remainingHours: roundTrainerHours(remainingHours),
		progressPercent:
			Number.isFinite(elapsedHours) &&
			Number.isFinite(plannedDurationHours) &&
			plannedDurationHours > 0
				? Math.round((elapsedHours / plannedDurationHours) * 100)
				: null,
		currentPhase: phase
			? {
					hour: phase.hour,
					label: phase.label,
					detail: getHourlyActionDetail(phase.hour) || null,
				}
			: null,
	};
}

function buildFastingScheduleContext() {
	const selectedType = getTypeById(selectedFastTypeId);
	const defaultType = getTypeById(state.settings.defaultFastTypeId);
	return {
		defaultFastType: buildTrainerFastTypeSummary(defaultType),
		selectedFastType: buildTrainerFastTypeSummary(selectedType),
	};
}

function buildTrainerCompletedFastSummary(entry) {
	const type = getTypeById(entry?.typeId);
	const startTimestamp = Number(entry?.startTimestamp);
	const endTimestamp = Number(entry?.endTimestamp);
	const durationHours = resolveDurationHours(
		entry,
		startTimestamp,
		endTimestamp,
	);
	const targetDurationHours = type?.durationHours ?? null;
	return {
		id: entry?.id || null,
		typeId: entry?.typeId || null,
		typeLabel: type?.label || entry?.typeLabel || "Custom",
		startedAt: Number.isFinite(startTimestamp)
			? new Date(startTimestamp).toISOString()
			: null,
		endedAt: Number.isFinite(endTimestamp)
			? new Date(endTimestamp).toISOString()
			: null,
		durationHours: roundTrainerHours(durationHours),
		targetDurationHours,
		metPlannedDuration:
			Number.isFinite(durationHours) && Number.isFinite(targetDurationHours)
				? durationHours >= targetDurationHours
				: null,
	};
}

function buildTrainerContinuityContext(
	rangeOverride = null,
	providerOverride = null,
) {
	const range =
		rangeOverride === null
			? getTrainerContextRange(providerOverride)
			: normalizeOpenAINotesRange(rangeOverride);
	const trainerNoteFilters = getAITrainerNoteFilters();
	const trainerNotes = getNotesForTrainer(range, trainerNoteFilters).map(
		(note) => ({
			date: note.createdAt ? new Date(note.createdAt).toISOString() : null,
			source: note.metadata?.source || "user",
			isAITrainerNote: isAITrainerNote(note),
			text: getDisplayNoteText(note) || null,
			userResponse:
				formatTrainerConversationMessagesForContext(
					parseTrainerConversationMessages(note.trainerResponse),
				) || null,
		}),
	);
	const completedFasts = getFastsForTrainer(range).map(
		buildTrainerCompletedFastSummary,
	);
	return {
		rangeLabel: OPENAI_NOTES_RANGE_LABELS[range],
		noteFilters: trainerNoteFilters.length
			? trainerNoteFilters.map(
					(filterId) => TRAINER_NOTE_FILTERS[filterId].label,
				)
			: null,
		notes: trainerNotes.length ? trainerNotes : null,
		completedFasts: completedFasts.length ? completedFasts : null,
	};
}

function compactAIContext(obj) {
	function strip(val) {
		if (val === null) return undefined;
		if (typeof val === "string" && val === "") return undefined;
		if (Array.isArray(val)) {
			const arr = val.map(strip).filter((v) => v !== undefined);
			return arr.length === 0 ? undefined : arr;
		}
		if (typeof val === "object") {
			const out = {};
			for (const [k, v] of Object.entries(val)) {
				const s = strip(v);
				if (s !== undefined) out[k] = s;
			}
			return Object.keys(out).length === 0 ? undefined : out;
		}
		return val;
	}
	return JSON.stringify(strip(obj) ?? null);
}

async function callAIChatCompletions({
	systemPrompt,
	userPrompt,
	purpose,
	withReasoningFallback = false,
	signal = null,
	providerOverride = null,
	modelOverride = null,
}) {
	const config = getAIProviderSettings(providerOverride);
	if (!config.apiUrl) {
		showToast(
			config.provider === "openai"
				? "OpenAI API endpoint is missing in settings"
				: "Please add your BYO API endpoint in settings first",
		);
		return null;
	}
	if (!config.model) {
		showToast(
			config.provider === "openai"
				? "Please select an OpenAI model in settings first"
				: "Please add your BYO model name in settings first",
		);
		return null;
	}
	if (!config.apiKey && config.provider === "openai") {
		showToast("Please add your OpenAI API key in settings first");
		return null;
	}
	if (config.provider === "byo" && config.headers === null) {
		showToast("Bring your own LLM headers must be valid JSON");
		return null;
	}

	const usingReasoning =
		config.reasoningEffort !== "none" &&
		(config.provider === "byo" || supportsReasoningEffort(config.model));
	const effectiveModel =
		modelOverride && config.provider === "openai"
			? modelOverride
			: config.model;
	const requestBody = {
		model: effectiveModel,
		messages: [
			{ role: "system", content: systemPrompt },
			{ role: "user", content: userPrompt },
		],
		max_completion_tokens: getMaxCompletionTokens(config, usingReasoning),
	};
	if (usingReasoning) {
		requestBody.reasoning_effort = config.reasoningEffort;
		resetReasoningSupportToast();
	} else if (
		config.reasoningEffort !== "none" &&
		config.provider === "openai"
	) {
		showReasoningUnsupportedToastOnce();
	}
	if (!usingReasoning || withReasoningFallback) {
		requestBody.temperature = config.temperature;
	}

	const headers = {
		"Content-Type": "application/json",
		...(config.headers || {}),
	};
	if (config.apiKey) headers.Authorization = `Bearer ${config.apiKey}`;

	const response = await fetch(config.apiUrl, {
		method: "POST",
		headers,
		body: JSON.stringify(requestBody),
		signal,
	});
	if (!response.ok) {
		let errorPayload = null;
		try {
			errorPayload = await response.json();
		} catch {}
		console.error(`${purpose} API error:`, errorPayload || response.statusText);
		showToast(
			`API error: ${errorPayload?.error?.message || errorPayload?.message || response.statusText || "Unknown error"}`,
		);
		return null;
	}
	const data = await response.json();
	if (data?.usage) {
		console.log(
			`[AI] ${purpose} — prompt_tokens: ${data.usage.prompt_tokens}, completion_tokens: ${data.usage.completion_tokens}, total_tokens: ${data.usage.total_tokens}`,
		);
	}
	return data;
}

async function recommendGoalPlanWithAI() {
	const provider = normalizeLLMProvider(state.settings.llmProvider);
	const byoLlm = normalizeByoLlmSettings(state.settings.byoLlm);
	const trainerInstructions = String(
		provider === "byo"
			? byoLlm.trainerInstructions
			: state.settings.openaiTrainerInstructions || "",
	).trim();

	const profile = buildGoalRecommendationProfile();
	const trainerContext = buildTrainerContinuityContext();
	const recommendationPrompt = [
		"You are a personal trainer and nutrition coach.",
		"Recommend a realistic calorie and daily nutrient plan tailored to the user profile.",
		"Always include dailyTarget as the user's target goal calories unless there is not enough profile information to estimate it responsibly.",
		"When goal is lose, maintain, or gain, make dailyTarget reflect that goal plus the user's instructions, journal notes, fasting schedule, and food preferences.",
		"Respect the user instructions and account for dietary needs, injuries, limitations, fasting schedule, and completed fasting history.",
		trainerContext.notes || trainerContext.completedFasts
			? "The user has shared journal notes - use them to refine your recommendations."
			: "",
		"Use trainerContext.completedFasts and activeFast when present to account for completed and current fasts.",
		"Return ONLY valid JSON in this exact shape:",
		'{"dailyTarget": number|null, "goal": "lose"|"maintain"|"gain"|null, "nutrientGoals": {"macros": {"protein": number|null, "carbs": number|null, "fat": number|null}, "micros": {"sodium": number|null, "potassium": number|null, "calcium": number|null, "iron": number|null, "magnesium": number|null, "zinc": number|null}, "vitamins": {"vitaminA": number|null, "vitaminC": number|null, "vitaminD": number|null, "vitaminB6": number|null, "vitaminB12": number|null}}}.',
		"Use grams for macros, milligrams for micros and vitaminC/vitaminB6, and micrograms for vitaminA/vitaminD/vitaminB12.",
		"Use numbers only, no units, no extra keys, no markdown, no explanation.",
	]
		.filter(Boolean)
		.join(" ");
	const userPayload = compactAIContext({
		profile,
		instructions: trainerInstructions || null,
		fastingSchedule: buildFastingScheduleContext(),
		activeFast: buildTrainerActiveFastContext(),
		trainerContext,
	});

	try {
		const data = await callAIChatCompletions({
			systemPrompt: recommendationPrompt,
			userPrompt: userPayload,
			purpose: "AI recommendation",
		});
		if (!data) {
			return null;
		}
		const aiText = data.choices[0]?.message?.content?.trim() || "";
		if (!aiText) {
			showToast("No response from AI");
			return null;
		}
		const parsedPayload = parseAIJsonPayload(aiText);
		const recommendation = normalizeAIRecommendedPlan(parsedPayload);
		if (!recommendation) {
			showToast("Could not parse goal recommendations from AI response");
			return null;
		}
		return recommendation;
	} catch (error) {
		console.error("Error calling AI API:", error);
		showToast("Failed to recommend goals. Check your internet connection.");
		return null;
	}
}

async function estimateCaloriesWithAI(noteContent) {
	const nutritionDetails = String(noteContent || "").trim();
	const nutritionPrompt = [
		"You are a precise nutritional expert.",
		"Analyze only the noteContent value provided and reason through each nutrient carefully.",
		"After your analysis, output ONLY valid JSON with this exact shape:",
		'{"calories": number|null, "macros": {"protein": number|null, "carbs": number|null, "fat": number|null}, "micros": {"sodium": number|null, "potassium": number|null, "calcium": number|null, "iron": number|null, "magnesium": number|null, "zinc": number|null}, "vitamins": {"vitaminA": number|null, "vitaminC": number|null, "vitaminD": number|null, "vitaminB6": number|null, "vitaminB12": number|null}}.',
		"If noteContent includes structured nutrition-label details such as serving information or listed nutrient values, extract those exact nutrition-facts values when possible.",
		"Use milligrams for sodium/potassium/calcium/iron/magnesium/zinc/vitaminC/vitaminB6 and micrograms for vitaminA/vitaminD/vitaminB12.",
		"Use numbers only, no units, no extra keys, no markdown, no explanation.",
		"If unknown, use null.",
		"Your final response must be the JSON object and nothing else.",
	].join(" ");

	if (!nutritionDetails) {
		showToast("Please enter note content for the AI estimate first");
		return null;
	}

	try {
		const data = await callAIChatCompletions({
			systemPrompt: nutritionPrompt,
			userPrompt: compactAIContext({ noteContent: nutritionDetails }),
			purpose: "AI nutrition estimate",
			withReasoningFallback: true,
			modelOverride: OPENAI_EXTRACTION_MODEL,
		});
		if (!data) {
			return null;
		}
		let aiText = data.choices[0]?.message?.content?.trim() || "";
		if (!aiText) {
			const toolCall = data.choices[0]?.message?.tool_calls?.find(
				(call) => call?.function?.name === "estimate_nutrition",
			);
			if (typeof toolCall?.function?.arguments === "string") {
				aiText = toolCall.function.arguments.trim();
			}
		}

		if (!aiText) {
			showToast("No response from AI");
			return null;
		}

		const parsedPayload = parseAIJsonPayload(aiText);
		const estimatedNutrition = normalizeAIEstimatedNutrition(parsedPayload);
		if (!estimatedNutrition) {
			showToast("Could not parse nutrition estimate from AI response");
			return null;
		}

		return estimatedNutrition;
	} catch (error) {
		console.error("Error calling AI API:", error);
		showToast("Failed to estimate nutrition. Check your internet connection.");
		return null;
	}
}

async function generateTrainerNoteWithAI(
	rangeOverride = null,
	signal = null,
	providerOverride = null,
) {
	const provider = normalizeLLMProvider(
		providerOverride === null ? state.settings.llmProvider : providerOverride,
	);
	const byoLlm = normalizeByoLlmSettings(state.settings.byoLlm);
	const trainerInstructions = String(
		provider === "byo"
			? byoLlm.trainerInstructions
			: state.settings.openaiTrainerInstructions || "",
	).trim();
	const profile = buildGoalRecommendationProfile();
	const trainerContext = buildTrainerContinuityContext(
		rangeOverride,
		providerOverride,
	);
	const todayKey = formatDateKey(new Date());
	const todayCalories = getNoteCaloriesForDateKey(todayKey);
	const todayNutrition = formatNutritionInlineSummary(todayKey);
	const userPayload = compactAIContext({
		profile,
		instructions: trainerInstructions || null,
		fastingSchedule: buildFastingScheduleContext(),
		activeFast: buildTrainerActiveFastContext(),
		today: {
			dateKey: todayKey,
			calories: Number.isFinite(todayCalories) ? todayCalories : null,
			nutritionSummary: todayNutrition || null,
		},
		trainerContext,
	});
	try {
		const data = await callAIChatCompletions({
			systemPrompt: AI_TRAINER_NOTE_PROMPT,
			userPrompt: userPayload,
			purpose: "AI trainer note",
			withReasoningFallback: true,
			signal,
			providerOverride: provider,
		});
		if (!data) return null;
		const messageContent = data.choices?.[0]?.message?.content;
		let aiText = "";
		if (typeof messageContent === "string") {
			aiText = messageContent.trim();
		} else if (Array.isArray(messageContent)) {
			aiText = messageContent
				.map((part) => (typeof part?.text === "string" ? part.text : ""))
				.join("\n")
				.trim();
		}
		if (!aiText) {
			showToast("No response from AI");
			return null;
		}
		return aiText;
	} catch (error) {
		if (error?.name === "AbortError") {
			showToast("Cancelled AI trainer note");
			return null;
		}
		console.error("Error calling AI API:", error);
		showToast(
			"Failed to generate trainer note. Please try again or check your AI settings.",
		);
		return null;
	}
}

async function addAITrainerNote(
	rangeOverride = null,
	signal = null,
	providerOverride = null,
) {
	const trainerText = await generateTrainerNoteWithAI(
		rangeOverride,
		signal,
		providerOverride,
	);
	if (!trainerText) return false;
	const noteId = await createNote({
		text: trainerText,
		dateKey: formatDateKey(new Date()),
		fastContext: buildFastContext(),
		metadata: {
			source: AI_TRAINER_NOTE_SOURCE,
			type: "trainer_note",
			isAINote: true,
			readOnly: true,
			contentFormat: "markdown",
			marker: AI_TRAINER_NOTE_MARKER,
			tags: [...AI_TRAINER_NOTE_TAGS],
		},
	});
	if (!noteId) {
		showToast("Failed to save AI trainer note");
		return false;
	}
	renderNotes();
	showToast("Added AI trainer note");
	return true;
}

async function generateTrainerQuickQuestionResponse({
	question,
	rangeOverride = null,
	providerOverride = null,
	signal = null,
}) {
	const provider = normalizeLLMProvider(
		providerOverride === null ? state.settings.llmProvider : providerOverride,
	);
	const normalizedQuestion = normalizeSingleParagraph(
		question,
		TRAINER_QUICK_QUESTION_MAX_CHARS,
	);
	if (!normalizedQuestion) {
		showToast("Ask a quick question first");
		return null;
	}
	const trainerContext = buildTrainerContinuityContext(
		rangeOverride,
		providerOverride,
	);
	const userPayload = compactAIContext({
		quickQuestion: normalizedQuestion,
		fastingSchedule: buildFastingScheduleContext(),
		activeFast: buildTrainerActiveFastContext(),
		today: {
			dateKey: formatDateKey(new Date()),
			nutritionSummary:
				formatNutritionInlineSummary(formatDateKey(new Date())) || null,
		},
		trainerContext,
	});
	try {
		const data = await callAIChatCompletions({
			systemPrompt: AI_TRAINER_QUICK_QUESTION_PROMPT,
			userPrompt: userPayload,
			purpose: "AI trainer quick question",
			withReasoningFallback: true,
			signal,
			providerOverride: provider,
		});
		if (!data) return null;
		const messageContent = data.choices?.[0]?.message?.content;
		let aiText = "";
		if (typeof messageContent === "string") {
			aiText = messageContent.trim();
		} else if (Array.isArray(messageContent)) {
			aiText = messageContent
				.map((part) => (typeof part?.text === "string" ? part.text : ""))
				.join("\n")
				.trim();
		}
		const firstParagraph = aiText.split(/\n\s*\n/u)[0] || "";
		const response = normalizeSingleParagraph(
			firstParagraph,
			TRAINER_QUICK_RESPONSE_MAX_CHARS,
		);
		if (!response) {
			showToast("No response from AI");
			return null;
		}
		return response;
	} catch (error) {
		if (error?.name === "AbortError") {
			showToast("Cancelled quick question");
			return null;
		}
		console.error("Error calling AI API:", error);
		showToast(
			"Failed to generate trainer response. Please try again or check your AI settings.",
		);
		return null;
	}
}

async function generateAITrainerNoteConversationResponse({
	note,
	message,
	conversation,
	rangeOverride = null,
	providerOverride = null,
	signal = null,
}) {
	const provider = normalizeLLMProvider(
		providerOverride === null ? state.settings.llmProvider : providerOverride,
	);
	const normalizedMessage = normalizeSingleParagraph(
		message,
		TRAINER_NOTE_CONVERSATION_MAX_CHARS,
	);
	if (!normalizedMessage) {
		showToast("Write a message first");
		return null;
	}
	const normalizedConversationMessages =
		normalizeTrainerConversationMessages(conversation);
	const userPayload = compactAIContext({
		coreNote: {
			id: note?.id || null,
			date: note?.createdAt ? new Date(note.createdAt).toISOString() : null,
			text: getDisplayNoteText(note) || null,
		},
		conversation: normalizedConversationMessages.length
			? normalizedConversationMessages.map((entry) => ({
					role: entry.role,
					content: entry.content,
				}))
			: null,
		userMessage: normalizedMessage,
		fastingSchedule: buildFastingScheduleContext(),
		activeFast: buildTrainerActiveFastContext(),
		today: {
			dateKey: formatDateKey(new Date()),
			nutritionSummary:
				formatNutritionInlineSummary(formatDateKey(new Date())) || null,
		},
		trainerContext: buildTrainerContinuityContext(
			rangeOverride,
			providerOverride,
		),
	});
	try {
		const data = await callAIChatCompletions({
			systemPrompt: AI_TRAINER_NOTE_CONVERSATION_PROMPT,
			userPrompt: userPayload,
			purpose: "AI trainer conversation",
			withReasoningFallback: true,
			signal,
			providerOverride: provider,
		});
		if (!data) return null;
		const messageContent = data.choices?.[0]?.message?.content;
		let aiText = "";
		if (typeof messageContent === "string") {
			aiText = messageContent.trim();
		} else if (Array.isArray(messageContent)) {
			aiText = messageContent
				.map((part) => (typeof part?.text === "string" ? part.text : ""))
				.join("\n")
				.trim();
		}
		const firstParagraph = aiText.split(/\n\s*\n/u)[0] || "";
		const response = normalizeSingleParagraph(
			firstParagraph,
			TRAINER_NOTE_CONVERSATION_MAX_CHARS,
		);
		if (!response) {
			showToast("No response from AI");
			return null;
		}
		return response;
	} catch (error) {
		if (error?.name === "AbortError") {
			showToast("Cancelled trainer message");
			return null;
		}
		console.error("Error calling AI API:", error);
		showToast(
			"Failed to continue trainer conversation. Please try again or check your AI settings.",
		);
		return null;
	}
}

async function addAITrainerQuickQuestionNote({
	question,
	rangeOverride = null,
	providerOverride = null,
	signal = null,
}) {
	const normalizedQuestion = normalizeSingleParagraph(
		question,
		TRAINER_QUICK_QUESTION_MAX_CHARS,
	);
	if (!normalizedQuestion) return false;
	const trainerResponse = await generateTrainerQuickQuestionResponse({
		question: normalizedQuestion,
		rangeOverride,
		providerOverride,
		signal,
	});
	if (!trainerResponse) return false;
	const noteText = AI_TRAINER_QUICK_NOTE_TEXT_TEMPLATE.replace(
		"{question}",
		normalizedQuestion,
	).replace("{response}", trainerResponse);
	const noteId = await createNote({
		text: noteText,
		dateKey: formatDateKey(new Date()),
		fastContext: buildFastContext(),
		metadata: {
			source: AI_TRAINER_NOTE_SOURCE,
			type: "trainer_note",
			isAINote: true,
			readOnly: true,
			contentFormat: "markdown",
			marker: AI_TRAINER_NOTE_MARKER,
			tags: [...AI_TRAINER_NOTE_TAGS],
		},
	});
	if (!noteId) {
		showToast("Failed to save quick question note");
		return false;
	}
	renderNotes();
	showToast("Added quick trainer response");
	return true;
}

function initButtons() {
	$("start-fast-btn").addEventListener("click", confirmStartFast);
	$("stop-fast-btn").addEventListener("click", confirmStopFast);

	$("fast-btn").addEventListener("click", () => {
		if (notesOverlayOpen) closeNotesDrawer();
		switchTab("timer");
	});

	$("calorie-btn").addEventListener("click", () => {
		if (notesOverlayOpen) closeNotesDrawer();
		switchTab("calories");
	});

	$("alerts-btn").addEventListener("click", onAlertsButton);

	$("modal-close").addEventListener("click", closeFastTypeModal);
	$("modal-use-type").addEventListener("click", usePendingFastType);
	$("confirm-fast-close").addEventListener("click", closeConfirmFastModal);
	$("confirm-fast-accept").addEventListener("click", confirmFastAction);
	const confirmBackdrop = document.querySelector(
		"#confirm-fast-modal .confirm-fast-backdrop",
	);
	if (confirmBackdrop)
		confirmBackdrop.addEventListener("click", closeConfirmFastModal);
	$("post-fast-note-close").addEventListener("click", closePostFastNoteModal);
	$("post-fast-note-no").addEventListener("click", closePostFastNoteModal);
	$("post-fast-note-yes").addEventListener("click", confirmPostFastNote);
	const postFastNoteBackdrop = document.querySelector(
		"#post-fast-note-modal .post-fast-note-backdrop",
	);
	if (postFastNoteBackdrop)
		postFastNoteBackdrop.addEventListener("click", closePostFastNoteModal);

	$("calorie-target-drawer-btn").addEventListener(
		"click",
		openCalorieTargetDrawer,
	);
	$("calorie-goal-drawer-btn").addEventListener("click", openCalorieGoalDrawer);
	$("history-progress-drawer-btn").addEventListener("click", () => {
		if (historyProgressOverlayOpen) closeHistoryProgressDrawer();
		else openHistoryProgressDrawer();
	});
	$("history-progress-close").addEventListener("click", () =>
		closeHistoryProgressDrawer(),
	);
	$("history-notes-drawer-btn").addEventListener("click", () => {
		if (historyNotesOverlayOpen) closeHistoryNotesDrawer();
		else openHistoryNotesDrawer();
	});
	$("history-notes-close").addEventListener("click", () =>
		closeHistoryNotesDrawer(),
	);
	$("recent-fasts-drawer-btn").addEventListener("click", () => {
		if (recentFastsOverlayOpen) closeRecentFastsDrawer();
		else openRecentFastsDrawer();
	});
	$("recent-fasts-close").addEventListener("click", () =>
		closeRecentFastsDrawer(),
	);
	$("nutrition-progress-drawer-btn").addEventListener(
		"click",
		openNutritionProgressDrawer,
	);
	$("nutrition-progress-close").addEventListener("click", () =>
		closeNutritionProgressDrawer(),
	);
	$("calorie-target-close").addEventListener("click", closeCalorieTargetDrawer);
	$("calorie-goal-close").addEventListener("click", closeCalorieGoalDrawer);
	$("settings-close").addEventListener("click", closeSettingsDrawer);

	$("llm-provider-openai").addEventListener("change", (event) => {
		if (!event.target.checked) return;
		state.settings.llmProvider = "openai";
		void saveState();
		renderSettings();
	});
	$("llm-provider-byo").addEventListener("change", (event) => {
		if (!event.target.checked) return;
		state.settings.llmProvider = "byo";
		void saveState();
		renderSettings();
	});

	$("toggle-end-alert").addEventListener("click", () => {
		state.settings.notifyOnEnd = !state.settings.notifyOnEnd;
		void saveState();
		renderSettings();
		renderAlertsPill();
	});

	$("toggle-hourly-alert").addEventListener("click", () => {
		state.settings.hourlyReminders = !state.settings.hourlyReminders;
		void saveState();
		renderSettings();
	});

	$("toggle-ring-emojis").addEventListener("click", () => {
		state.settings.showRingEmojis = !state.settings.showRingEmojis;
		void saveState();
		renderSettings();
		applyRingEmojiVisibility();
		updateTimer();
		renderCalories();
	});

	$("openai-api-key").addEventListener("change", async (event) => {
		const apiKey = event.target.value.trim();
		state.settings.openaiApiKey = apiKey;
		void saveState();

		// Save encrypted key to user document for cross-device sync
		if (apiKey) {
			try {
				await saveSecureKey("openaikey", apiKey);
			} catch (err) {
				console.error("Failed to save API key to user document:", err);
			}
		}
		await loadOpenAIModels(true);
		renderSettings();
	});

	$("byo-llm-api-url").addEventListener("change", (event) => {
		state.settings.byoLlm = normalizeByoLlmSettings({
			...state.settings.byoLlm,
			apiUrl: event.target.value,
		});
		void saveState();
		renderSettings();
	});
	$("byo-llm-model").addEventListener("change", (event) => {
		state.settings.byoLlm = normalizeByoLlmSettings({
			...state.settings.byoLlm,
			model: event.target.value,
		});
		void saveState();
		renderSettings();
	});
	$("byo-llm-reasoning-effort").addEventListener("change", (event) => {
		state.settings.byoLlm = normalizeByoLlmSettings({
			...state.settings.byoLlm,
			reasoningEffort: event.target.value,
		});
		void saveState();
		renderSettings();
	});
	$("byo-llm-max-tokens").addEventListener("change", (event) => {
		state.settings.byoLlm = normalizeByoLlmSettings({
			...state.settings.byoLlm,
			maxCompletionTokens: event.target.value,
		});
		void saveState();
		renderSettings();
	});
	$("byo-llm-temperature").addEventListener("change", (event) => {
		state.settings.byoLlm = normalizeByoLlmSettings({
			...state.settings.byoLlm,
			temperature: event.target.value,
		});
		void saveState();
		renderSettings();
	});
	$("byo-llm-headers").addEventListener("change", (event) => {
		state.settings.byoLlm = normalizeByoLlmSettings({
			...state.settings.byoLlm,
			headersJson: event.target.value,
		});
		void saveState();
		renderSettings();
	});
	$("byo-llm-api-key").addEventListener("change", async (event) => {
		const apiKey = sanitizeBearerToken(event.target.value);
		state.settings.byoLlm = normalizeByoLlmSettings({
			...state.settings.byoLlm,
			apiKey,
		});
		void saveState();
		if (apiKey) {
			try {
				await saveSecureKey("byollmapikey", apiKey);
			} catch (err) {
				console.error("Failed to save BYO API key to user document:", err);
			}
		}
		renderSettings();
	});

	$("openai-model-select").addEventListener("change", (event) => {
		state.settings.openaiModel = normalizeOpenAIModel(event.target.value);
		if (syncReasoningSettingForModel()) {
			showToast("Reasoning mode was turned off for this model");
		}
		resetReasoningSupportToast();
		void saveState();
	});

	$("openai-reasoning-effort").addEventListener("change", (event) => {
		state.settings.openaiReasoningEffort = normalizeOpenAIReasoningEffort(
			event.target.value,
		);
		resetReasoningSupportToast();
		void saveState();
	});

	const openaiTrainerInstructions = $("openai-trainer-instructions");
	if (openaiTrainerInstructions) {
		openaiTrainerInstructions.addEventListener("change", (event) => {
			state.settings.openaiTrainerInstructions = String(
				event.target.value || "",
			);
			void saveState();
		});
	}
	const byoTrainerInstructions = $("byo-llm-trainer-instructions");
	if (byoTrainerInstructions) {
		byoTrainerInstructions.addEventListener("change", (event) => {
			state.settings.byoLlm = normalizeByoLlmSettings({
				...state.settings.byoLlm,
				trainerInstructions: String(event.target.value || ""),
			});
			void saveState();
		});
	}

	$("openai-notes-range").addEventListener("input", (event) => {
		state.settings.openaiNotesRange = normalizeOpenAINotesRange(
			event.target.value,
		);
		const label = $("openai-notes-range-label");
		if (label)
			label.textContent =
				OPENAI_NOTES_RANGE_LABELS[state.settings.openaiNotesRange];
		if (aiTrainerNotesRangeOverride === null) {
			renderAITrainerNotesRangeOverride();
		}
		void saveState();
	});
	$("byo-llm-notes-range").addEventListener("input", (event) => {
		const notesRange = normalizeOpenAINotesRange(event.target.value);
		state.settings.byoLlm = normalizeByoLlmSettings({
			...state.settings.byoLlm,
			notesRange,
		});
		const label = $("byo-llm-notes-range-label");
		if (label) label.textContent = OPENAI_NOTES_RANGE_LABELS[notesRange];
		if (aiTrainerNotesRangeOverride === null) {
			renderAITrainerNotesRangeOverride();
		}
		void saveState();
	});

	$("theme-preset-select").addEventListener("change", (event) => {
		setThemePreset(event.target.value);
		applyThemeColors();
		renderSettings();
		void saveState();
	});

	$("theme-primary-color").addEventListener("input", (event) => {
		setCustomThemeColor("primaryColor", event.target.value);
		applyThemeColors();
		void saveState();
	});

	$("theme-secondary-color").addEventListener("input", (event) => {
		setCustomThemeColor("secondaryColor", event.target.value);
		applyThemeColors();
		void saveState();
	});

	$("theme-background-color").addEventListener("input", (event) => {
		setCustomThemeColor("backgroundColor", event.target.value);
		applyThemeColors();
		void saveState();
	});

	$("theme-surface-color").addEventListener("input", (event) => {
		setCustomThemeColor("surfaceColor", event.target.value);
		applyThemeColors();
		void saveState();
	});

	$("theme-surface-muted-color").addEventListener("input", (event) => {
		setCustomThemeColor("surfaceMutedColor", event.target.value);
		applyThemeColors();
		void saveState();
	});

	$("theme-border-color").addEventListener("input", (event) => {
		setCustomThemeColor("borderColor", event.target.value);
		applyThemeColors();
		void saveState();
	});

	$("theme-text-color").addEventListener("input", (event) => {
		setCustomThemeColor("textColor", event.target.value);
		applyThemeColors();
		void saveState();
	});

	$("theme-text-muted-color").addEventListener("input", (event) => {
		setCustomThemeColor("textMutedColor", event.target.value);
		applyThemeColors();
		void saveState();
	});

	$("theme-danger-color").addEventListener("input", (event) => {
		setCustomThemeColor("dangerColor", event.target.value);
		applyThemeColors();
		void saveState();
	});

	$("export-data").addEventListener("click", exportCSV);
	$("clear-data").addEventListener("click", clearAllData);
	$("sign-out").addEventListener("click", async () => {
		try {
			await signOut(auth);
		} catch {}
	});

	$("calendar-prev").addEventListener("click", () => {
		calendarMonth = addMonths(calendarMonth, -1);
		renderCalendar();
		renderDayDetails();
		renderNotes();
	});
	$("calendar-next").addEventListener("click", () => {
		calendarMonth = addMonths(calendarMonth, 1);
		renderCalendar();
		renderDayDetails();
		renderNotes();
	});

	$("default-fast-select").addEventListener("change", (e) => {
		selectedFastTypeId = e.target.value;
		state.settings.defaultFastTypeId = selectedFastTypeId;
		void saveState();
		highlightSelectedFastType();
		if (!state.activeFast) renderTimerMetaIdle();
		updateTimer();
	});

	$("timer-main").addEventListener("click", cycleTimeMode);

	$("meta-start-btn").addEventListener("click", () => {
		if (!state.activeFast) return;
		openEditStartModal();
	});

	$("edit-start-close").addEventListener("click", closeEditStartModal);
	$("edit-start-now").addEventListener("click", () => {
		$("edit-start-input").value = toLocalInputValue(new Date());
	});
	$("edit-start-save").addEventListener("click", saveEditedStartTime);

	$("edit-history-close").addEventListener("click", closeEditHistoryModal);
	$("edit-history-start-now").addEventListener("click", () => {
		$("edit-history-start").value = toLocalInputValue(new Date());
	});
	$("edit-history-end-now").addEventListener("click", () => {
		$("edit-history-end").value = toLocalInputValue(new Date());
	});
	$("edit-history-save").addEventListener("click", saveEditedHistoryTimes);
	$("edit-history-delete").addEventListener("click", deleteEditedHistoryEntry);

	$("new-note-btn").addEventListener("click", () => openNoteEditor());
	const trainerOptionsToggle = $("trainer-options-toggle");
	const trainerOptionsPanel = $("trainer-options-panel");
	if (trainerOptionsToggle && trainerOptionsPanel) {
		trainerOptionsToggle.addEventListener("click", () => {
			const isOpen = trainerOptionsPanel.classList.toggle("is-open");
			trainerOptionsToggle.classList.toggle("is-open", isOpen);
			trainerOptionsToggle.setAttribute("aria-expanded", String(isOpen));
			trainerOptionsPanel.setAttribute("aria-hidden", String(!isOpen));
			trainerOptionsToggle.textContent = isOpen
				? "↑↑↑ HIDE TRAINER OPTIONS ↑↑↑"
				: "↓↓↓ SHOW MORE TRAINER OPTIONS ↓↓↓";
		});
	}
	const updateAITrainerNotesRangeOverride = (event) => {
		aiTrainerNotesRangeOverride = normalizeOpenAINotesRange(event.target.value);
		renderAITrainerNotesRangeOverride();
		renderNotes();
	};
	$("ai-trainer-notes-range").addEventListener(
		"input",
		updateAITrainerNotesRangeOverride,
	);
	$("ai-trainer-notes-range").addEventListener(
		"change",
		updateAITrainerNotesRangeOverride,
	);
	document.querySelectorAll("[data-trainer-note-filter]").forEach((button) => {
		button.addEventListener("click", () => {
			toggleAITrainerNoteFilter(button.dataset.trainerNoteFilter);
		});
	});
	const clearTrainerNoteFilters = $("ai-trainer-clear-filters");
	if (clearTrainerNoteFilters) {
		clearTrainerNoteFilters.addEventListener("click", () => {
			setAITrainerNoteFilters([]);
		});
	}
	$("ai-trainer-provider-override-openai").addEventListener(
		"change",
		(event) => {
			if (!event.target.checked) return;
			aiTrainerProviderOverride = "openai";
			renderAITrainerProviderOverride();
			renderNotes();
		},
	);
	$("ai-trainer-provider-override-byo").addEventListener("change", (event) => {
		if (!event.target.checked) return;
		aiTrainerProviderOverride = "byo";
		renderAITrainerProviderOverride();
		renderNotes();
	});
	$("ai-trainer-provider-override-clear").addEventListener("click", () => {
		aiTrainerProviderOverride = null;
		renderAITrainerProviderOverride();
		renderNotes();
	});
	const quickQuestionInput = $("trainer-quick-question-input");
	if (quickQuestionInput) {
		quickQuestionInput.addEventListener("input", () => {
			renderTrainerQuickQuestionInput();
		});
	}
	$("trainer-quick-question-send").addEventListener("click", async () => {
		const input = $("trainer-quick-question-input");
		const button = $("trainer-quick-question-send");
		if (!input || !button) return;
		const question = normalizeSingleParagraph(
			input.value,
			TRAINER_QUICK_QUESTION_MAX_CHARS,
		);
		if (!question) {
			showToast("Ask a quick question first");
			renderTrainerQuickQuestionInput();
			return;
		}
		if (quickTrainerQuestionAbortController || aiTrainerNoteAbortController) {
			showToast("A trainer request is already running");
			return;
		}
		const abortController = new AbortController();
		quickTrainerQuestionAbortController = abortController;
		const originalText = button.textContent;
		button.disabled = true;
		button.textContent = "Sending...";
		try {
			const added = await addAITrainerQuickQuestionNote({
				question,
				rangeOverride: getAITrainerNotesRangeOverride(),
				providerOverride: getAITrainerProviderOverride(),
				signal: abortController.signal,
			});
			if (added) input.value = "";
		} finally {
			if (quickTrainerQuestionAbortController === abortController) {
				quickTrainerQuestionAbortController = null;
			}
			button.textContent = originalText;
			button.disabled = false;
			renderTrainerQuickQuestionInput();
		}
	});
	$("ai-trainer-note-btn").addEventListener("click", async () => {
		const button = $("ai-trainer-note-btn");
		if (aiTrainerNoteAbortController) {
			aiTrainerNoteAbortController.abort();
			return;
		}
		const abortController = new AbortController();
		aiTrainerNoteAbortController = abortController;
		const originalText = button.textContent;
		button.textContent = "Cancel trainer note";
		button.classList.remove("button-accent");
		button.classList.add("button-danger");
		try {
			await addAITrainerNote(
				getAITrainerNotesRangeOverride(),
				abortController.signal,
				getAITrainerProviderOverride(),
			);
		} finally {
			if (aiTrainerNoteAbortController === abortController) {
				aiTrainerNoteAbortController = null;
			}
			button.textContent = originalText;
			button.classList.add("button-accent");
			button.classList.remove("button-danger");
		}
	});
	$("calorie-log-meal-btn").addEventListener("click", () => openNoteEditor());
	const noteEditorBackdrop = document.querySelector(
		"#note-editor-modal .note-editor-backdrop",
	);
	if (noteEditorBackdrop)
		noteEditorBackdrop.addEventListener("click", closeNoteEditor);
	$("note-editor-close").addEventListener("click", closeNoteEditor);
	$("note-editor-save").addEventListener("click", saveNoteEditor);
	$("note-editor-delete").addEventListener("click", removeNote);
	const noteEditorTrainerInput = $("note-editor-trainer-response");
	if (noteEditorTrainerInput) {
		noteEditorTrainerInput.addEventListener("input", () => {
			renderNoteEditorTrainerConversation();
		});
	}
	$("note-editor-trainer-send").addEventListener(
		"click",
		sendNoteEditorTrainerMessage,
	);
	$("calorie-goal-recommend-btn").addEventListener("click", async () => {
		const button = $("calorie-goal-recommend-btn");
		const originalText = button.textContent;
		button.disabled = true;
		button.textContent = "Recommending...";
		const recommendation = await recommendGoalPlanWithAI();
		button.disabled = false;
		button.textContent = originalText;
		if (!recommendation) return;
		const settings = getCalorieSettings();
		let updated = false;
		if (
			Number.isFinite(recommendation.dailyTarget) &&
			recommendation.dailyTarget > 0
		) {
			const currentTarget = getCalorieTarget();
			const nextTarget = Math.round(recommendation.dailyTarget);
			if (!currentTarget || Math.round(currentTarget) !== nextTarget) {
				setCalorieTargetSettings(settings, nextTarget);
				updated = true;
			}
		}
		if (recommendation.goal) {
			settings.goal = recommendation.goal;
			updated = true;
		}
		const hasRecommendedNutrients = hasAnyNutrientValue(
			recommendation.nutrientGoals?.macros,
			recommendation.nutrientGoals?.micros,
			recommendation.nutrientGoals?.vitamins,
			{
				positiveOnly: true,
			},
		);
		if (hasRecommendedNutrients) {
			settings.nutrientGoals = recommendation.nutrientGoals;
			updated = true;
		}
		if (!updated) {
			showToast("AI returned no usable updates");
			return;
		}
		void saveState();
		renderCalories();
		showToast("Applied AI goal recommendations");
	});
	$("note-editor-ai-estimate").addEventListener("click", async () => {
		const noteContent = $("note-editor-content")?.value.trim() || "";
		const button = $("note-editor-ai-estimate");
		const originalHTML = button.innerHTML;

		// Disable button and show loading state
		button.disabled = true;
		button.innerHTML =
			'<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="animate-spin"><path d="M21 12a9 9 0 1 1-6.219-8.56"></path></svg>';

		const estimatedNutrition = await estimateCaloriesWithAI(noteContent);

		// Re-enable button and restore original icon
		button.disabled = false;
		button.innerHTML = originalHTML;

		if (estimatedNutrition !== null) {
			$("note-editor-calories").value = Number.isFinite(
				estimatedNutrition.calories,
			)
				? String(estimatedNutrition.calories)
				: "";
			setNoteEditorNutritionFields(estimatedNutrition);
			const caloriesLabel = Number.isFinite(estimatedNutrition.calories)
				? ` ${estimatedNutrition.calories} calories`
				: " nutrition facts";
			showToast(`Filled${caloriesLabel} with AI`);
		}
	});
	attachNoteEditorSwipeHandlers();

	document.addEventListener("visibilitychange", () => {
		if (!document.hidden) renderAll();
	});
}

function openConfirmFastModal({
	title,
	message,
	confirmLabel,
	confirmClasses,
	onConfirm,
	focusAfterClose,
}) {
	$("confirm-fast-title").textContent = title;
	$("confirm-fast-message").textContent = message;
	$("confirm-fast-accept").textContent = confirmLabel;
	$("confirm-fast-accept").className = confirmClasses;
	pendingConfirmAction = onConfirm;
	pendingConfirmCloseFocus = focusAfterClose || null;
	$("confirm-fast-modal").classList.remove("hidden");
}

function closeConfirmFastModal() {
	$("confirm-fast-modal").classList.add("hidden");
	pendingConfirmAction = null;
	if (pendingConfirmCloseFocus) {
		pendingConfirmCloseFocus.focus();
	}
	pendingConfirmCloseFocus = null;
}

function confirmFastAction() {
	if (typeof pendingConfirmAction === "function") {
		pendingConfirmAction();
	}
	closeConfirmFastModal();
}

function openPostFastNoteModal({ fastContext, dateKey, focusAfterClose } = {}) {
	pendingPostFastNote = {
		fastContext: fastContext ?? buildInactiveFastContext(),
		dateKey: dateKey ?? formatDateKey(new Date()),
	};
	pendingConfirmCloseFocus = focusAfterClose || null;
	$("post-fast-note-modal").classList.remove("hidden");
}

function closePostFastNoteModal() {
	$("post-fast-note-modal").classList.add("hidden");
	pendingPostFastNote = null;
	if (pendingConfirmCloseFocus) {
		pendingConfirmCloseFocus.focus();
	}
	pendingConfirmCloseFocus = null;
}

function confirmPostFastNote() {
	const noteContext = pendingPostFastNote;
	closePostFastNoteModal();
	if (!noteContext) return;
	openNotesDrawer();
	openNoteEditor({
		text: "",
		dateKey: noteContext.dateKey,
		fastContext: noteContext.fastContext,
	});
}

function confirmStartFast(event) {
	const type = getTypeById(selectedFastTypeId);
	if (!type) return;
	openConfirmFastModal({
		title: "Start this fast?",
		message: `Start a ${type.label} fast for ${type.durationHours} hours?`,
		confirmLabel: "Start fast",
		confirmClasses:
			"w-full py-3 md:py-2.5 rounded-xl button-primary text-sm md:text-xs font-semibold",
		onConfirm: startFast,
		focusAfterClose: event?.currentTarget,
	});
}

function confirmStopFast(event) {
	const af = state.activeFast;
	if (!af) return;
	const type = getTypeById(af.typeId);
	const typeLabel = type ? type.label : "current";
	openConfirmFastModal({
		title: "Stop this fast?",
		message: `Stop and log your ${typeLabel} fast now?`,
		confirmLabel: "Stop fast",
		confirmClasses:
			"w-full py-3 md:py-2.5 rounded-xl button-danger border text-sm md:text-xs font-semibold",
		onConfirm: stopFastAndLog,
		focusAfterClose: event?.currentTarget,
	});
}

function initSettings() {
	const sel = $("default-fast-select");
	sel.innerHTML = "";
	FAST_TYPES.forEach((t) => {
		const o = document.createElement("option");
		o.value = t.id;
		o.textContent = `${t.label} (${t.durationHours}h)`;
		sel.appendChild(o);
	});

	const themeSelect = $("theme-preset-select");
	themeSelect.innerHTML = "";
	THEME_PRESET_LIST.forEach((preset) => {
		const option = document.createElement("option");
		option.value = preset.id;
		option.textContent = preset.label;
		themeSelect.appendChild(option);
	});
	const customOption = document.createElement("option");
	customOption.value = "custom";
	customOption.textContent = "Custom";
	themeSelect.appendChild(customOption);

	const unitSelect = $("calorie-unit-system");
	if (unitSelect) {
		unitSelect.addEventListener("change", (event) => {
			const settings = getCalorieSettings();
			settings.unitSystem =
				event.target.value === "imperial" ? "imperial" : "metric";
			void saveState();
			renderCalories();
			renderSettings();
		});
	}
}

function renderSettings() {
	const customTheme = getCustomThemeColors();
	const presetId = resolveThemePresetId();
	const unitSelect = $("calorie-unit-system");
	const unitSystem = getCalorieUnitSystem();
	const llmProvider = normalizeLLMProvider(state.settings.llmProvider);
	const byoLlm = normalizeByoLlmSettings(state.settings.byoLlm);
	const reasoningSelect = $("openai-reasoning-effort");
	const apiKey = state.settings.openaiApiKey?.trim();
	$("default-fast-select").value = resolveFastTypeId(
		state.settings.defaultFastTypeId,
	);
	$("toggle-end-alert").classList.toggle("on", !!state.settings.notifyOnEnd);
	$("toggle-hourly-alert").classList.toggle(
		"on",
		!!state.settings.hourlyReminders,
	);
	$("toggle-ring-emojis").classList.toggle(
		"on",
		state.settings.showRingEmojis !== false,
	);
	if (unitSelect) unitSelect.value = unitSystem;
	$("llm-provider-openai").checked = llmProvider === "openai";
	$("llm-provider-byo").checked = llmProvider === "byo";
	$("openai-settings-panel").classList.toggle(
		"hidden",
		llmProvider !== "openai",
	);
	$("byo-llm-settings-panel").classList.toggle("hidden", llmProvider !== "byo");
	$("openai-trainer-settings-panel").classList.toggle(
		"hidden",
		llmProvider !== "openai",
	);
	$("byo-trainer-settings-panel").classList.toggle(
		"hidden",
		llmProvider !== "byo",
	);
	const openaiTrainerInstructionsPanel = $("openai-trainer-instructions-panel");
	if (openaiTrainerInstructionsPanel) {
		openaiTrainerInstructionsPanel.classList.toggle(
			"hidden",
			llmProvider !== "openai",
		);
	}
	const byoTrainerInstructionsPanel = $("byo-trainer-instructions-panel");
	if (byoTrainerInstructionsPanel) {
		byoTrainerInstructionsPanel.classList.toggle(
			"hidden",
			llmProvider !== "byo",
		);
	}
	$("openai-api-key").value = state.settings.openaiApiKey || "";
	const openaiTrainerInstructions = $("openai-trainer-instructions");
	if (openaiTrainerInstructions) {
		openaiTrainerInstructions.value =
			state.settings.openaiTrainerInstructions || "";
	}
	$("byo-llm-api-url").value = byoLlm.apiUrl;
	$("byo-llm-api-key").value = byoLlm.apiKey;
	$("byo-llm-model").value = byoLlm.model;
	$("byo-llm-reasoning-effort").value = byoLlm.reasoningEffort;
	$("byo-llm-max-tokens").value = String(byoLlm.maxCompletionTokens);
	$("byo-llm-temperature").value = String(byoLlm.temperature);
	$("byo-llm-headers").value = byoLlm.headersJson;
	const byoTrainerInstructions = $("byo-llm-trainer-instructions");
	if (byoTrainerInstructions) {
		byoTrainerInstructions.value = byoLlm.trainerInstructions;
	}
	const notesRangeSlider = $("openai-notes-range");
	if (notesRangeSlider) {
		const rangeVal = normalizeOpenAINotesRange(state.settings.openaiNotesRange);
		notesRangeSlider.value = rangeVal;
		const label = $("openai-notes-range-label");
		if (label) label.textContent = OPENAI_NOTES_RANGE_LABELS[rangeVal];
	}
	const byoNotesRangeSlider = $("byo-llm-notes-range");
	if (byoNotesRangeSlider) {
		const rangeVal = normalizeOpenAINotesRange(byoLlm.notesRange);
		byoNotesRangeSlider.value = rangeVal;
		const label = $("byo-llm-notes-range-label");
		if (label) label.textContent = OPENAI_NOTES_RANGE_LABELS[rangeVal];
	}
	if (aiTrainerNotesRangeOverride === null) {
		renderAITrainerNotesRangeOverride();
	}
	renderOpenAIModelOptions();
	if (reasoningSelect) {
		reasoningSelect.value = normalizeOpenAIReasoningEffort(
			state.settings.openaiReasoningEffort,
		);
	}
	if (syncReasoningSettingForModel()) void saveState();
	$("theme-preset-select").value = presetId;
	$("theme-custom-controls").classList.toggle("hidden", presetId !== "custom");
	$("theme-primary-color").value = customTheme.primaryColor;
	$("theme-secondary-color").value = customTheme.secondaryColor;
	$("theme-background-color").value = customTheme.backgroundColor;
	$("theme-surface-color").value = customTheme.surfaceColor;
	$("theme-surface-muted-color").value = customTheme.surfaceMutedColor;
	$("theme-border-color").value = customTheme.borderColor;
	$("theme-text-color").value = customTheme.textColor;
	$("theme-text-muted-color").value = customTheme.textMutedColor;
	$("theme-danger-color").value = customTheme.dangerColor;
	if (
		apiKey &&
		(openAIModelsLoadedForKey !== apiKey || !openAIModelOptions.length)
	) {
		void loadOpenAIModels();
	}
	renderAlertsPill();
}

function applyRingEmojiVisibility() {
	const isEnabled = state.settings.showRingEmojis !== false;
	const layer = $("ring-emoji-layer");
	const panel = $("ring-emoji-panel");
	const calorieLayer = $("calorie-ring-emoji-layer");
	const caloriePanel = $("calorie-tip-panel");
	if (layer) layer.classList.toggle("hidden", !isEnabled);
	if (panel) panel.classList.toggle("hidden", !isEnabled);
	if (calorieLayer) calorieLayer.classList.toggle("hidden", !isEnabled);
	if (caloriePanel) caloriePanel.classList.toggle("hidden", !isEnabled);
	if (!isEnabled) {
		ringEmojiTypeId = null;
		ringEmojiLayoutSize = 0;
		ringEmojiSelectionKey = null;
		ringEmojiSelectionDetail = null;
		calorieTipGoalId = null;
		calorieTipLayoutSize = 0;
		calorieTipSelectionKey = null;
	}
}

function startFast() {
	const type = getTypeById(selectedFastTypeId);
	const now = Date.now();
	state.activeFast = {
		id: `fast_${now}`,
		typeId: type.id,
		startTimestamp: now,
		plannedDurationHours: type.durationHours,
		endTimestamp: now + type.durationHours * 3600000,
		status: "active",
		milestonesHit: [],
	};
	state.reminders = { endNotified: false, lastHourlyAt: null };
	selectedDayKey = formatDateKey(new Date(now));
	calendarMonth = startOfMonth(new Date(now));
	void saveState();
	renderAll();
	showToast("Fast started");
}

function stopFastAndLog() {
	const endedFast = state.activeFast;
	if (!endedFast) return;
	const now = Date.now();
	const endTs = now;
	const durHrs = Math.max(0, (endTs - endedFast.startTimestamp) / 3600000);

	state.history.unshift({
		id: endedFast.id,
		typeId: endedFast.typeId,
		startTimestamp: endedFast.startTimestamp,
		endTimestamp: endTs,
		durationHours: Math.round(durHrs * 100) / 100,
	});

	state.activeFast = null;
	state.reminders = { endNotified: false, lastHourlyAt: null };
	void saveState();

	calendarMonth = startOfMonth(new Date());
	selectedDayKey = formatDateKey(new Date());
	renderAll();
	showToast("Fast logged");
	openPostFastNoteModal({
		fastContext: buildFastContextFromFast(endedFast, endTs),
		dateKey: formatDateKey(new Date(endTs)),
	});
}

function startTick() {
	if (tickHandle) clearInterval(tickHandle);
	tickHandle = setInterval(() => {
		updateTimer();
		handleAlerts();
	}, 1000);
	updateTimer();
	renderAlertsPill();
}

function stopTick() {
	if (!tickHandle) return;
	clearInterval(tickHandle);
	tickHandle = null;
}

function cycleTimeMode() {
	const order = ["elapsed", "total", "remaining"];
	const cur = state.settings.timeDisplayMode || "elapsed";
	const next = order[(order.indexOf(cur) + 1) % order.length];
	state.settings.timeDisplayMode = next;
	void saveState();
	updateTimer();
}

function ensureRingEmojis() {
	if (state.settings.showRingEmojis === false) return;
	const type = getActiveType();
	const layer = $("ring-emoji-layer");
	if (!layer || !type) return;
	const size = layer.clientWidth;
	const shouldRender =
		!layer.childElementCount ||
		ringEmojiTypeId !== type.id ||
		ringEmojiLayoutSize !== size;
	if (shouldRender) {
		renderRingEmojis(type, size);
	} else {
		updateRingEmojiProgress(type);
	}
}

function renderRingEmojis(type, size) {
	const layer = $("ring-emoji-layer");
	const title = $("ring-emoji-title");
	const detail = $("ring-emoji-detail");
	if (!layer || !title || !detail) return;

	ringEmojiTypeId = type.id;
	ringEmojiLayoutSize = size;
	layer.innerHTML = "";

	const milestones = Array.isArray(type.milestones) ? type.milestones : [];
	if (!milestones.length || !size) {
		title.textContent = "Tap an orb to see what's happening";
		detail.textContent = "";
		return;
	}

	const radius = Math.max(size / 2 - 18, 0);
	const center = size / 2;

	milestones.forEach((milestone) => {
		const angle = (milestone.hour / type.durationHours) * 360 - 90;
		const rad = angle * (Math.PI / 180);
		const btn = document.createElement("button");
		btn.type = "button";
		btn.className = "ring-emoji-btn";
		btn.textContent = milestone.emoji;
		btn.style.left = `${center + Math.cos(rad) * radius}px`;
		btn.style.top = `${center + Math.sin(rad) * radius}px`;
		btn.dataset.hour = String(milestone.hour);
		btn.dataset.typeId = type.id;
		btn.addEventListener("click", () => selectRingEmoji(type, milestone));
		layer.appendChild(btn);
	});

	const hasSelection = milestones.some(
		(m) => `${type.id}-${m.hour}` === ringEmojiSelectionKey,
	);
	if (!hasSelection) {
		ringEmojiSelectionKey = null;
		ringEmojiSelectionDetail = null;
	}
	if (ringEmojiSelectionKey) {
		const selected = milestones.find(
			(m) => `${type.id}-${m.hour}` === ringEmojiSelectionKey,
		);
		updateRingEmojiPanel(type, selected);
	} else {
		title.textContent = "Tap an orb to see what's happening";
		detail.textContent = `${type.label} milestones wrap the ring.`;
	}

	updateRingEmojiSelectionStyles();
	updateRingEmojiProgress(type);
}

function selectRingEmoji(type, milestone) {
	ringEmojiSelectionKey = `${type.id}-${milestone.hour}`;
	ringEmojiSelectionDetail =
		getRandomMilestoneDetail(milestone.hour) ?? milestone.detail;
	updateRingEmojiPanel(type, milestone);
	updateRingEmojiSelectionStyles();
}

function getRandomMilestoneDetail(hour) {
	return getHourlyActionDetail(hour, { random: true });
}

function updateRingEmojiPanel(type, milestone) {
	const title = $("ring-emoji-title");
	const detail = $("ring-emoji-detail");
	if (!title || !detail) return;

	if (!milestone) {
		title.textContent = "Tap an orb to see what's happening";
		detail.textContent = `${type.label} milestones wrap the ring.`;
		return;
	}

	title.textContent = `Hour ${milestone.hour}${UI_MIDDOT_SEPARATOR}${milestone.label}`;
	detail.textContent = ringEmojiSelectionDetail ?? milestone.detail;
}

function updateRingEmojiSelectionStyles() {
	const layer = $("ring-emoji-layer");
	if (!layer) return;
	layer.querySelectorAll(".ring-emoji-btn").forEach((btn) => {
		const key = `${btn.dataset.typeId}-${btn.dataset.hour}`;
		if (key === ringEmojiSelectionKey) btn.classList.add("is-selected");
		else btn.classList.remove("is-selected");
	});
}

function updateRingEmojiProgress(type) {
	const layer = $("ring-emoji-layer");
	if (!layer) return;
	const elapsedHours = state.activeFast
		? Math.max(0, (Date.now() - state.activeFast.startTimestamp) / 3600000)
		: null;
	const _milestones = Array.isArray(type?.milestones) ? type.milestones : [];

	layer.querySelectorAll(".ring-emoji-btn").forEach((btn) => {
		const hour = Number(btn.dataset.hour);
		const isActive = elapsedHours !== null && elapsedHours >= hour;
		const isUpcoming = elapsedHours !== null && elapsedHours < hour;
		if (isActive) btn.classList.add("is-active");
		else btn.classList.remove("is-active");
		if (isUpcoming) btn.classList.add("is-upcoming");
		else btn.classList.remove("is-upcoming");
	});

	if (ringEmojiSelectionKey) {
		const selectedButton = layer.querySelector(
			`[data-type-id="${type.id}"][data-hour="${ringEmojiSelectionKey.split("-")[1]}"]`,
		);
		if (!selectedButton || selectedButton.hidden) {
			ringEmojiSelectionKey = null;
			ringEmojiSelectionDetail = null;
			updateRingEmojiPanel(type, null);
			updateRingEmojiSelectionStyles();
		}
	}
}

function updateTimer() {
	const ring = $("progress-ring");
	const main = $("timer-main");
	const mode = $("timer-mode");
	const sub = $("timer-sub");
	const header = $("header-subtitle");
	const status = $("timer-status");
	const typePill = $("timer-type");

	ring.setAttribute("stroke-dasharray", String(RING_CIRC));
	applyRingEmojiVisibility();
	ensureRingEmojis();

	const displayMode = state.settings.timeDisplayMode || "elapsed";
	const type = getActiveType();
	typePill.textContent = type ? `${type.label} fast` : "No fast selected";

	highlightSelectedFastType();

	if (!state.activeFast) {
		status.textContent = "IDLE";
		header.textContent = "No active fast";
		ring.setAttribute("stroke-dashoffset", String(RING_CIRC));
		renderTimerMetaIdle();

		const plannedMs = (type?.durationHours || 0) * 3600000;
		const totalStr = formatHMS(plannedMs);

		if (displayMode === "elapsed") {
			mode.textContent = "Time Fasted";
			main.textContent = "00:00:00";
			sub.textContent = "Tap time to change view";
		} else if (displayMode === "total") {
			mode.textContent = "Total Fast";
			main.textContent = totalStr;
			sub.textContent = "Tap time to change view";
		} else {
			mode.textContent = "Time Remaining";
			main.textContent = totalStr;
			sub.textContent = "Tap time to change view";
		}

		$("start-fast-btn").classList.remove("hidden");
		$("stop-fast-btn").classList.add("hidden");
		$("meta-start-btn").disabled = true;
		renderFastButton();
		return;
	}

	trackMilestoneProgress(type);

	const af = state.activeFast;
	const now = Date.now();
	const start = af.startTimestamp;
	const end = af.endTimestamp;

	const total = Math.max(1, end - start);
	const elapsed = Math.max(0, now - start);
	const remaining = end - now;

	const progress = Math.min(elapsed / total, 1);
	ring.setAttribute("stroke-dashoffset", String(RING_CIRC * (1 - progress)));

	$("meta-start-btn").disabled = false;
	$("meta-start-btn").textContent = formatDateTime(new Date(start));
	$("meta-end").textContent = formatDateTime(new Date(end));

	$("start-fast-btn").classList.add("hidden");
	$("stop-fast-btn").classList.remove("hidden");

	if (now < end) {
		status.textContent = "FASTING";
		header.textContent = `Ends ${formatTimeShort(new Date(end))}`;
	} else {
		status.textContent = "COMPLETE";
		header.textContent = "Fast complete";
	}

	if (displayMode === "elapsed") {
		mode.textContent = "Time Fasted";
		main.textContent = formatHMS(elapsed);
		sub.textContent = "Tap time to change view";
	} else if (displayMode === "total") {
		mode.textContent = "Total Fast";
		main.textContent = formatHMS(total);
		sub.textContent = "Tap time to change view";
	} else {
		if (remaining >= 0) {
			mode.textContent = "Time Remaining";
			main.textContent = formatHMS(remaining);
			sub.textContent = "Tap time to change view";
		} else {
			mode.textContent = "Extra Time Fasted";
			main.textContent = formatHMS(-remaining);
			sub.textContent = "Tap time to change view";
		}
	}
	renderFastButton();
}

function trackMilestoneProgress(type) {
	if (!state.activeFast || !type) return;
	const milestones = Array.isArray(type.milestones) ? type.milestones : [];
	if (!milestones.length) return;
	if (!Array.isArray(state.activeFast.milestonesHit)) {
		state.activeFast.milestonesHit = [];
	}
	if (!state.milestoneTally || typeof state.milestoneTally !== "object") {
		state.milestoneTally = {};
	}
	const elapsedHours = Math.max(
		0,
		(Date.now() - state.activeFast.startTimestamp) / 3600000,
	);
	let updated = false;
	milestones.forEach((milestone) => {
		if (elapsedHours < milestone.hour) return;
		if (state.activeFast.milestonesHit.includes(milestone.hour)) return;
		state.activeFast.milestonesHit.push(milestone.hour);
		const key = String(milestone.hour);
		state.milestoneTally[key] = (state.milestoneTally[key] || 0) + 1;
		updated = true;
	});
	if (updated) void saveState();
}

function renderTimerMetaIdle() {
	const _type = getTypeById(selectedFastTypeId);
	$("meta-start-btn").textContent = UI_EM_DASH;
	$("meta-end").textContent = UI_EM_DASH;
}

async function onAlertsButton() {
	if (!("Notification" in window)) {
		showToast("Notifications not supported");
		return;
	}
	if (Notification.permission === "denied") {
		showToast("Alerts blocked in browser settings");
		return;
	}

	if (Notification.permission === "default") {
		const res = await Notification.requestPermission();
		if (res !== "granted") {
			showToast("Permission not granted");
			renderAlertsPill();
			return;
		}
		state.settings.alertsEnabled = true;
		void saveState();
		renderAlertsPill();
		await sendNotification(
			"Alerts enabled",
			"You'll be notified when your fast ends.",
		);
		showToast("Alerts enabled");
		return;
	}

	state.settings.alertsEnabled = !state.settings.alertsEnabled;
	void saveState();
	renderAlertsPill();

	if (state.settings.alertsEnabled) {
		await sendNotification(
			"Alerts enabled",
			"You'll be notified when your fast ends.",
		);
		showToast("Alerts enabled");
	} else {
		showToast("Alerts disabled");
	}
}

function renderAlertsPill() {
	const dot = $("alerts-dot");
	const text = $("alerts-text");
	const dotBaseClasses = "w-2 h-2 md:w-1.5 md:h-1.5 rounded-full";
	const textBaseClasses = "text-xs md:text-[11px]";

	if (!("Notification" in window)) {
		dot.className = `${dotBaseClasses} bg-slate-600`;
		text.textContent = "Off";
		text.className = `${textBaseClasses} text-slate-600`;
		return;
	}
	if (Notification.permission === "denied") {
		dot.className = `${dotBaseClasses} bg-red-500`;
		text.textContent = "Off";
		text.className = `${textBaseClasses} text-red-500`;
		return;
	}
	if (Notification.permission === "default") {
		dot.className = `${dotBaseClasses} bg-slate-600`;
		text.textContent = "Off";
		text.className = `${textBaseClasses} text-slate-600`;
		return;
	}
	if (state.settings.alertsEnabled) {
		dot.className = `${dotBaseClasses} bg-emerald-400`;
		text.textContent = "On";
		text.className = `${textBaseClasses} text-emerald-400`;
	} else {
		dot.className = `${dotBaseClasses} bg-slate-600`;
		text.textContent = "Off";
		text.className = `${textBaseClasses} text-slate-600`;
	}
}

async function sendNotification(title, body) {
	if (!("Notification" in window)) return;
	if (Notification.permission !== "granted") return;

	try {
		if (swReg?.showNotification) {
			await swReg.showNotification(title, {
				body,
				icon: "assets/favicon/android-chrome-192x192.png",
				badge: "assets/favicon/android-chrome-192x192.png",
				tag: "fasting-tracker",
			});
			return;
		}
	} catch {}

	try {
		new Notification(title, { body });
	} catch {}
}

function handleAlerts() {
	if (!state.activeFast) return;
	if (!state.settings.alertsEnabled) return;
	if (!("Notification" in window)) return;
	if (Notification.permission !== "granted") return;

	const now = Date.now();
	const af = state.activeFast;
	const endTs = af.endTimestamp;

	if (!state.reminders.endNotified && now >= endTs) {
		if (state.settings.notifyOnEnd)
			sendNotification("Fast complete", "You reached your fasting goal.");
		state.reminders.endNotified = true;
		state.reminders.lastHourlyAt = now;
		void saveState();
		return;
	}

	if (state.reminders.endNotified && state.settings.hourlyReminders) {
		const last = state.reminders.lastHourlyAt || endTs;
		if (now - last >= 3600000) {
			sendNotification(
				"Extra hour fasted",
				"You're past your target. Break your fast when ready.",
			);
			state.reminders.lastHourlyAt = now;
			void saveState();
		}
	}
}

function openEditStartModal() {
	const start = new Date(state.activeFast.startTimestamp);
	$("edit-start-input").value = toLocalInputValue(start);
	$("edit-start-modal").classList.remove("hidden");
}

function closeEditStartModal() {
	$("edit-start-modal").classList.add("hidden");
}

function saveEditedStartTime() {
	if (!state.activeFast) return;
	const v = $("edit-start-input").value;
	if (!v) {
		showToast("Invalid time");
		return;
	}
	const d = new Date(v);
	if (!Number.isFinite(d.getTime())) {
		showToast("Invalid time");
		return;
	}

	const af = state.activeFast;
	const plannedMs =
		(af.plannedDurationHours || getActiveType().durationHours || 0) * 3600000;
	af.startTimestamp = d.getTime();
	af.endTimestamp = af.startTimestamp + plannedMs;
	af.status = "active";
	state.reminders = { endNotified: false, lastHourlyAt: null };
	selectedDayKey = formatDateKey(new Date(af.startTimestamp));
	calendarMonth = startOfMonth(new Date(af.startTimestamp));

	void saveState();
	closeEditStartModal();
	updateTimer();
	renderCalendar();
	renderDayDetails();
	showToast("Start time updated");
}

function openEditHistoryModal(entry) {
	if (!entry || entry.isActive) return;
	editingHistoryId = entry.id;
	$("edit-history-start").value = toLocalInputValue(
		new Date(entry.startTimestamp),
	);
	$("edit-history-end").value = toLocalInputValue(new Date(entry.endTimestamp));
	$("edit-history-modal").classList.remove("hidden");
}

function closeEditHistoryModal() {
	$("edit-history-modal").classList.add("hidden");
	editingHistoryId = null;
}

function saveEditedHistoryTimes() {
	if (!editingHistoryId) return;
	const entry = state.history.find((item) => item.id === editingHistoryId);
	if (!entry) {
		closeEditHistoryModal();
		return;
	}

	const startValue = $("edit-history-start").value;
	const endValue = $("edit-history-end").value;
	if (!startValue || !endValue) {
		showToast("Invalid time");
		return;
	}

	const startDate = new Date(startValue);
	const endDate = new Date(endValue);
	if (
		!Number.isFinite(startDate.getTime()) ||
		!Number.isFinite(endDate.getTime())
	) {
		showToast("Invalid time");
		return;
	}
	if (endDate <= startDate) {
		showToast("End time must be after start time");
		return;
	}

	entry.startTimestamp = startDate.getTime();
	entry.endTimestamp = endDate.getTime();
	const durationHours = (entry.endTimestamp - entry.startTimestamp) / 3600000;
	entry.durationHours = Math.round(durationHours * 100) / 100;

	selectedDayKey = formatDateKey(new Date(entry.startTimestamp));
	calendarMonth = startOfMonth(new Date(entry.startTimestamp));

	void saveState();
	closeEditHistoryModal();
	renderCalendar();
	renderDayDetails();
	renderRecentFasts();
	showToast("Fast updated");
}

function deleteEditedHistoryEntry() {
	if (!editingHistoryId) return;
	deleteHistoryEntry(editingHistoryId);
}

function deleteHistoryEntry(entryId) {
	if (!entryId) return;
	const entry = state.history.find((item) => item.id === entryId);
	if (!entry) return;
	if (!confirm("Delete this fast? This cannot be undone.")) return;

	state.history = state.history.filter((item) => item.id !== entryId);
	if (editingHistoryId === entryId) closeEditHistoryModal();
	void saveState();
	renderCalendar();
	renderDayDetails();
	renderRecentFasts();
	showToast("Fast deleted");
}

function showToast(msg) {
	const t = $("toast");
	t.textContent = msg;
	t.classList.remove("hidden");
	clearTimeout(toastHandle);
	toastHandle = setTimeout(() => t.classList.add("hidden"), 2200);
}

function exportCSV() {
	const rows = [];
	rows.push(
		["id", "typeId", "typeLabel", "startISO", "endISO", "durationHours"].join(
			",",
		),
	);
	for (const e of state.history) {
		const type = getTypeById(e.typeId);
		const startISO = new Date(e.startTimestamp).toISOString();
		const endISO = new Date(e.endTimestamp).toISOString();
		const duration =
			(typeof e.durationHours === "number"
				? e.durationHours
				: Number(e.durationHours)) || 0;
		rows.push(
			[
				csvCell(e.id),
				csvCell(e.typeId),
				csvCell(type?.label || ""),
				csvCell(startISO),
				csvCell(endISO),
				csvCell(duration.toFixed(2)),
			].join(","),
		);
	}
	const csv = rows.join("\n");
	const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = "history.csv";
	document.body.appendChild(a);
	a.click();
	a.remove();
	URL.revokeObjectURL(url);
	showToast("Exported CSV");
}

function csvCell(v) {
	const s = String(v ?? "");
	if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
	return s;
}

function clearAllData() {
	if (!confirm("Clear all fasting history and active fast?")) return;
	state = clone(defaultState);
	selectedFastTypeId = state.settings.defaultFastTypeId;
	pendingTypeId = null;
	void saveState();
	renderAll();
	showToast("Cleared");
}

function initCalendar() {
	calendarMonth = startOfMonth(new Date());
	selectedDayKey = formatDateKey(new Date());
}

function renderCalendar() {
	const label = $("calendar-label");
	const grid = $("calendar-grid");
	label.textContent = calendarMonth.toLocaleDateString(undefined, {
		month: "long",
		year: "numeric",
	});
	grid.innerHTML = "";

	const first = startOfMonth(calendarMonth);
	const startWeekday = first.getDay();
	const daysInMonth = getDaysInMonth(calendarMonth);
	const prevMonth = addMonths(calendarMonth, -1);
	const daysInPrev = getDaysInMonth(prevMonth);

	const dayMap = buildDayFastMap();
	const todayKey = formatDateKey(new Date());

	for (let i = 0; i < 42; i++) {
		const cell = document.createElement("button");
		cell.type = "button";
		cell.className =
			"calendar-day aspect-square flex flex-col items-center justify-center text-[12px] md:text-[11px]";

		let dayNum,
			date,
			isCurrent = false;

		if (i < startWeekday) {
			dayNum = daysInPrev - startWeekday + i + 1;
			date = new Date(prevMonth.getFullYear(), prevMonth.getMonth(), dayNum);
			cell.classList.add("calendar-day--muted");
		} else if (i >= startWeekday + daysInMonth) {
			dayNum = i - startWeekday - daysInMonth + 1;
			const nextMonth = addMonths(calendarMonth, 1);
			date = new Date(nextMonth.getFullYear(), nextMonth.getMonth(), dayNum);
			cell.classList.add("calendar-day--muted");
		} else {
			dayNum = i - startWeekday + 1;
			date = new Date(
				calendarMonth.getFullYear(),
				calendarMonth.getMonth(),
				dayNum,
			);
			isCurrent = true;
			cell.classList.add("calendar-day--current");
		}

		const key = formatDateKey(date);
		const data = dayMap[key];
		const hasFast = !!data;
		const isSelected = key === selectedDayKey;
		const isToday = key === todayKey;

		if (isSelected) cell.classList.add("calendar-day--selected");
		else if (hasFast) cell.classList.add("calendar-day--has-fast");
		else cell.classList.add("calendar-day--empty");

		if (isToday && isCurrent) {
			const dot = document.createElement("span");
			dot.className =
				"calendar-day-dot w-2 h-2 md:w-1.5 md:h-1.5 rounded-full mb-0.5";
			cell.appendChild(dot);
		}

		const dspan = document.createElement("span");
		dspan.textContent = dayNum;
		cell.appendChild(dspan);

		if (hasFast) {
			const tiny = document.createElement("span");
			tiny.className = "calendar-day-hours mt-0.5 text-[10px] md:text-[9px]";
			tiny.textContent = `${Math.round(data.totalHours)}h`;
			cell.appendChild(tiny);
		}

		cell.addEventListener("click", () => {
			selectedDayKey = key;
			renderCalendar();
			renderDayDetails();
			renderNotes();
		});

		grid.appendChild(cell);
	}
}

function buildDayFastMap({ includeActive = false } = {}) {
	const map = {};

	const addEntryForDay = (entry, startTs, endTs, dayKey) => {
		if (!map[dayKey]) map[dayKey] = { entries: [], totalHours: 0 };
		const durationHours = computeDurationHours(startTs, endTs) ?? 0;
		if (!durationHours) return;
		map[dayKey].entries.push({
			...entry,
			durationHours,
			displayStartTimestamp: startTs,
			displayEndTimestamp: endTs,
			sourceEntry: entry,
		});
		map[dayKey].totalHours += durationHours;
	};

	const addEntryAcrossDays = (entry, startTs, endTs) => {
		if (
			!Number.isFinite(startTs) ||
			!Number.isFinite(endTs) ||
			endTs <= startTs
		)
			return;
		let cursor = new Date(startTs);
		cursor = new Date(
			cursor.getFullYear(),
			cursor.getMonth(),
			cursor.getDate(),
		);
		const endDay = new Date(endTs);
		const endDayStart = new Date(
			endDay.getFullYear(),
			endDay.getMonth(),
			endDay.getDate(),
		);

		while (cursor <= endDayStart) {
			const dayStart = new Date(cursor);
			const dayEnd = new Date(dayStart);
			dayEnd.setDate(dayEnd.getDate() + 1);
			const displayStart = Math.max(startTs, dayStart.getTime());
			const displayEnd = Math.min(endTs, dayEnd.getTime());
			const dayKey = formatDateKey(cursor);
			addEntryForDay(entry, displayStart, displayEnd, dayKey);
			cursor.setDate(cursor.getDate() + 1);
		}
	};

	state.history.forEach((e) => {
		addEntryAcrossDays(e, e.startTimestamp, e.endTimestamp);
	});

	if (includeActive && state.activeFast) {
		const af = state.activeFast;
		const endTs = Date.now();
		addEntryAcrossDays({ ...af, isActive: true }, af.startTimestamp, endTs);
	}

	return map;
}

function getHistoryTrendEntries(selectedDate, dayCount = 7) {
	const map = buildDayFastMap({ includeActive: true });
	const entries = [];
	for (let i = dayCount - 1; i >= 0; i--) {
		const date = new Date(selectedDate.getTime() - i * 24 * 60 * 60 * 1000);
		const key = formatDateKey(date);
		entries.push({
			key,
			date,
			totalHours: map[key]?.totalHours ?? 0,
		});
	}
	return entries;
}

function resolveDurationHours(entry, startTs, endTs) {
	const numericDuration = Number(entry?.durationHours);
	if (Number.isFinite(numericDuration)) return numericDuration;
	return computeDurationHours(startTs, endTs) ?? 0;
}

function appendHistoryAnalyticsCard(container, card) {
	const cardEl = document.createElement("div");
	cardEl.className = "history-analytics-card";

	const label = document.createElement("div");
	label.className = "history-analytics-label";
	label.textContent = card.label;

	const value = document.createElement("div");
	value.className = "history-analytics-value";
	value.textContent = card.value;

	const meta = document.createElement("div");
	meta.className = "history-analytics-meta";
	meta.textContent = card.meta;

	cardEl.appendChild(label);
	cardEl.appendChild(value);
	cardEl.appendChild(meta);
	container.appendChild(cardEl);
}

function appendHistoryComparisonRow(container, entry, trendMax) {
	const row = document.createElement("div");
	row.className = "history-chart-row";
	if (entry.key !== selectedDayKey)
		row.classList.add("history-chart-row--inactive");

	const dayLabel = document.createElement("div");
	dayLabel.className = "history-chart-label";
	dayLabel.textContent = entry.date.toLocaleDateString(undefined, {
		weekday: "short",
	});

	const track = document.createElement("div");
	track.className = "history-chart-track";
	const fill = document.createElement("div");
	fill.className = "history-chart-fill";
	const widthPercent = Math.min(100, (entry.totalHours / trendMax) * 100);
	fill.style.width = `${widthPercent}%`;
	track.appendChild(fill);

	const value = document.createElement("div");
	value.className = "history-chart-value";
	value.textContent = `${entry.totalHours.toFixed(1)}h`;

	row.appendChild(dayLabel);
	row.appendChild(track);
	row.appendChild(value);
	container.appendChild(row);
}

function renderHistoryProgressAnalytics(day) {
	const kpiContainer = $("history-progress-kpis");
	const chartContainer = $("history-progress-chart");
	if (!kpiContainer || !chartContainer) return;

	kpiContainer.innerHTML = "";
	chartContainer.innerHTML = "";

	const selectedDate = parseDateKey(selectedDayKey) || new Date();
	const trend = getHistoryTrendEntries(selectedDate, 7);
	const trendTotal = trend.reduce((sum, entry) => sum + entry.totalHours, 0);
	const trendAverage = trend.length ? trendTotal / trend.length : 0;
	const trendMax = Math.max(1, ...trend.map((entry) => entry.totalHours));

	const dayNoteCalories = getNoteCaloriesForDateKey(selectedDayKey);
	const nutritionSummary = formatNutritionInlineSummary(selectedDayKey);
	const analyticsCards = [
		{
			label: "Fasts logged",
			value: `${day?.entries?.length ?? 0}`,
			meta: "Sessions on the selected day",
		},
		{
			label: "Hours total",
			value: `${(day?.totalHours ?? 0).toFixed(1)}h`,
			meta: `7-day average ${trendAverage.toFixed(1)}h`,
		},
		{
			label: "Nutrition context",
			value:
				Number.isFinite(dayNoteCalories) && dayNoteCalories > 0
					? `${formatCalories(dayNoteCalories)} cal`
					: "No calories logged",
			meta: nutritionSummary || "No macro, vitamin, or mineral entries",
		},
	];

	analyticsCards.forEach((card) => {
		appendHistoryAnalyticsCard(kpiContainer, card);
	});
	trend.forEach((entry) => {
		appendHistoryComparisonRow(chartContainer, entry, trendMax);
	});
}

function renderDayDetails() {
	const summary = $("day-summary");
	const list = $("day-fast-list");
	const map = buildDayFastMap({ includeActive: true });
	const day = map[selectedDayKey];
	if (!summary || !list) return;

	list.innerHTML = "";

	if (!day) {
		summary.textContent = "No fasts logged for this day";
		renderHistoryProgressAnalytics(null);
		return;
	}

	const SUMMARY_SEPARATOR = UI_BULLET_SEPARATOR;
	const dayNoteCalories = getNoteCaloriesForDateKey(selectedDayKey);
	const calorieSummary =
		Number.isFinite(dayNoteCalories) && dayNoteCalories > 0
			? `${SUMMARY_SEPARATOR}${formatCalories(dayNoteCalories)} calories`
			: "";
	const nutritionSummary = formatNutritionInlineSummary(selectedDayKey);
	const nutritionTail = nutritionSummary
		? `${SUMMARY_SEPARATOR}${nutritionSummary}`
		: "";
	const sessionLabel = day.entries.length === 1 ? "session" : "sessions";
	summary.textContent = `${day.entries.length} ${sessionLabel}${SUMMARY_SEPARATOR}${day.totalHours.toFixed(1)} total hours${calorieSummary}${nutritionTail}`;
	renderHistoryProgressAnalytics(day);

	day.entries.forEach((e) => {
		const displayStart = e.displayStartTimestamp ?? e.startTimestamp;
		const displayEnd = e.displayEndTimestamp ?? e.endTimestamp;
		const sourceEntry = e.sourceEntry ?? e;
		const actualStartTs = Number.isFinite(sourceEntry.startTimestamp)
			? sourceEntry.startTimestamp
			: displayStart;
		const actualEndTs = Number.isFinite(sourceEntry.endTimestamp)
			? sourceEntry.endTimestamp
			: displayEnd;
		const spansMultipleDays = !isSameLocalDay(
			new Date(actualStartTs),
			new Date(actualEndTs),
		);
		const row = document.createElement("div");
		row.className = "history-fast-card";

		const type = getTypeById(e.typeId);
		const title = document.createElement("div");
		title.className = "history-fast-title";
		const label = type ? type.label : "Custom";
		const durationHours = resolveDurationHours(e, displayStart, displayEnd);
		title.textContent = e.isActive
			? `Active${UI_BULLET_SEPARATOR}${label} fast`
			: `${label}${UI_BULLET_SEPARATOR}${durationHours.toFixed(1)}h`;

		const time = document.createElement("div");
		time.className = "history-fast-subtitle";
		const timeLabel = spansMultipleDays
			? `${formatDateTimeLong(new Date(actualStartTs))}${UI_ARROW_SEPARATOR}${formatDateTimeLong(new Date(displayEnd))}`
			: `${formatTimeShort(new Date(displayStart))}${UI_ARROW_SEPARATOR}${formatTimeShort(new Date(displayEnd))}`;
		time.textContent = e.isActive ? `${timeLabel} (in progress)` : timeLabel;

		row.appendChild(title);
		row.appendChild(time);

		if (!e.isActive) {
			const actions = document.createElement("div");
			actions.className = "history-fast-actions";

			const editBtn = document.createElement("button");
			editBtn.type = "button";
			editBtn.className =
				"button-outline border text-xs md:text-[11px] px-3 py-2 md:px-2 md:py-1 rounded-full";
			editBtn.textContent = "Edit";
			editBtn.addEventListener("click", () =>
				openEditHistoryModal(sourceEntry),
			);

			const deleteBtn = document.createElement("button");
			deleteBtn.type = "button";
			deleteBtn.className =
				"button-danger border text-xs md:text-[11px] px-3 py-2 md:px-2 md:py-1 rounded-full";
			deleteBtn.textContent = "Delete";
			deleteBtn.addEventListener("click", () =>
				deleteHistoryEntry(sourceEntry.id),
			);

			actions.appendChild(editBtn);
			actions.appendChild(deleteBtn);
			row.appendChild(actions);
		}

		list.appendChild(row);
	});
}

function isSameLocalDay(a, b) {
	return (
		a.getFullYear() === b.getFullYear() &&
		a.getMonth() === b.getMonth() &&
		a.getDate() === b.getDate()
	);
}

function formatDateTimeLong(date) {
	const mm = String(date.getMonth() + 1).padStart(2, "0");
	const dd = String(date.getDate()).padStart(2, "0");
	const yyyy = date.getFullYear();
	const hh = String(date.getHours()).padStart(2, "0");
	const min = String(date.getMinutes()).padStart(2, "0");
	return `${mm}/${dd}/${yyyy} ${hh}:${min}`;
}

function renderNotes() {
	renderHistoryNotes();
	renderNotesTab();
	renderAITrainerNotesRangeOverride();
	renderAITrainerProviderOverride();
	renderTrainerQuickQuestionInput();
	renderNoteEditorTrainerConversation();
	renderCalorieSummary();
	renderCalorieRing();
	renderCalorieButton();
	renderNutritionTracker();
}

function renderAITrainerNotesRangeOverride() {
	const slider = $("ai-trainer-notes-range");
	const label = $("ai-trainer-notes-range-label");
	if (!slider || !label) return;
	const range = getAITrainerNotesRangeOverride();
	slider.value = range;
	label.textContent = OPENAI_NOTES_RANGE_LABELS[range];
	renderAITrainerNoteFilters();
	renderNotesTab();
}

function renderAITrainerProviderOverride() {
	const openai = $("ai-trainer-provider-override-openai");
	const byo = $("ai-trainer-provider-override-byo");
	const subtitle = $("trainer-provider-override-subtitle");
	const clearButton = $("ai-trainer-provider-override-clear");
	if (!openai || !byo || !subtitle || !clearButton) return;
	const globalProvider = normalizeLLMProvider(state.settings.llmProvider);
	const selectedProvider = getAITrainerProviderOverride();
	openai.checked = selectedProvider === "openai";
	byo.checked = selectedProvider === "byo";
	subtitle.textContent =
		aiTrainerProviderOverride === null
			? `Global default: ${globalProvider === "byo" ? "Custom model" : "OpenAI"}`
			: `Override active: ${selectedProvider === "byo" ? "Custom model" : "OpenAI"}`;
	clearButton.disabled = aiTrainerProviderOverride === null;
}

function renderTrainerQuickQuestionInput() {
	const input = $("trainer-quick-question-input");
	const count = $("trainer-quick-question-count");
	const sendButton = $("trainer-quick-question-send");
	if (!input || !count || !sendButton) return;
	const trimmed = normalizeSingleParagraph(
		input.value,
		TRAINER_QUICK_QUESTION_MAX_CHARS,
	);
	count.textContent = `${trimmed.length} / ${TRAINER_QUICK_QUESTION_MAX_CHARS}`;
	sendButton.disabled =
		!trimmed || Boolean(quickTrainerQuestionAbortController);
}

function renderAITrainerNoteFilters() {
	const selectedFilters = getAITrainerNoteFilters();
	const selected = new Set(selectedFilters);
	document.querySelectorAll("[data-trainer-note-filter]").forEach((button) => {
		const filterId = button.dataset.trainerNoteFilter;
		const isActive = selected.has(filterId);
		button.classList.toggle("is-active", isActive);
		button.setAttribute("aria-pressed", isActive ? "true" : "false");
	});
	const clearButton = $("ai-trainer-clear-filters");
	if (clearButton) clearButton.disabled = selectedFilters.length === 0;
	const subtitle = $("trainer-note-filters-subtitle");
	if (subtitle)
		subtitle.textContent = getTrainerNoteFilterSummary(selectedFilters);
}

function renderHistoryNotes() {
	const summary = $("today-notes-summary");
	const list = $("today-notes-list");
	if (!summary || !list) return;

	list.innerHTML = "";

	if (!notesLoaded) {
		summary.textContent = `Loading notes${UI_ELLIPSIS}`;
		return;
	}

	const todayKey = formatDateKey(new Date());
	const dayNotes = notes.filter((note) => note.dateKey === todayKey);
	if (!dayNotes.length) {
		summary.textContent = "No notes yet.";
		return;
	}

	const dayNoteCalories = getNoteCaloriesForDateKey(todayKey);
	const calorieSummary =
		Number.isFinite(dayNoteCalories) && dayNoteCalories > 0
			? `, ${formatCalories(dayNoteCalories)} calories`
			: "";
	const nutritionSummary = formatNutritionInlineSummary(todayKey);
	const nutritionTail = nutritionSummary ? `, ${nutritionSummary}` : "";
	summary.textContent = `${dayNotes.length} note(s)${calorieSummary}${nutritionTail}`;
	dayNotes.forEach((note) => {
		list.appendChild(buildNoteCard(note));
	});
}

function renderNotesTab() {
	const list = $("notes-list");
	const empty = $("notes-empty");
	const emptyTitle = $("notes-empty-title");
	const emptyBody = $("notes-empty-body");
	const viewerSummary = $("notes-viewer-summary");
	if (!list || !empty || !emptyTitle || !emptyBody) return;

	list.innerHTML = "";
	if (viewerSummary) {
		viewerSummary.textContent = "";
		viewerSummary.classList.add("hidden");
	}

	if (!notesLoaded) {
		emptyTitle.textContent = `Loading notes${UI_ELLIPSIS}`;
		emptyBody.textContent = "Your notes will appear here once they sync.";
		empty.classList.remove("hidden");
		return;
	}

	if (!notes.length) {
		emptyTitle.textContent = "No notes yet";
		emptyBody.textContent = "Start a new note to track how your fast feels.";
		empty.classList.remove("hidden");
		return;
	}

	const previewNotes = getNotesForTrainer(getAITrainerNotesRangeOverride());
	const hiddenCount = Math.max(0, notes.length - previewNotes.length);
	const visibleLabel = previewNotes.length === 1 ? "note" : "notes";
	const totalLabel = notes.length === 1 ? "note" : "notes";
	empty.classList.add("hidden");
	if (viewerSummary) {
		if (hiddenCount > 0) {
			viewerSummary.textContent = `Showing ${previewNotes.length} of ${notes.length} ${totalLabel} selected for trainer preview.`;
		} else if (previewNotes.length) {
			viewerSummary.textContent = `Showing all ${previewNotes.length} ${visibleLabel} selected for trainer preview.`;
		} else {
			viewerSummary.textContent = "Trainer preview is set to send no notes.";
		}
		viewerSummary.classList.remove("hidden");
	}
	if (!previewNotes.length) {
		emptyTitle.textContent = "No notes selected";
		emptyBody.textContent =
			"Adjust the trainer note range or filters above to preview notes that will be sent.";
		empty.classList.remove("hidden");
		return;
	}
	previewNotes.forEach((note) => {
		list.appendChild(buildNoteCard(note));
	});
}

function escapeHtml(value) {
	return String(value ?? "")
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;")
		.replaceAll("'", "&#39;");
}

function sanitizeMarkdownHref(value) {
	const href = String(value || "").trim();
	if (!href) return "";
	if (href.startsWith("#") || href.startsWith("/")) return href;
	try {
		const url = new URL(href, window.location.origin);
		if (["http:", "https:", "mailto:", "tel:"].includes(url.protocol)) {
			return href;
		}
	} catch {}
	return "";
}

function renderMarkdownInline(value) {
	let html = escapeHtml(value);
	html = html.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_match, label, href) => {
		const safeHref = sanitizeMarkdownHref(href);
		if (!safeHref) return label;
		return `<a href="${escapeHtml(safeHref)}" target="_blank" rel="noopener noreferrer">${label}</a>`;
	});
	html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
	html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
	html = html.replace(/(^|[\s(])\*([^*\n]+)\*/g, "$1<em>$2</em>");
	return html;
}

function renderMarkdownToHtml(markdown) {
	const lines = String(markdown || "")
		.replace(/\r\n/g, "\n")
		.split("\n");
	const html = [];
	let paragraph = [];
	let listType = null;

	const flushParagraph = () => {
		if (!paragraph.length) return;
		html.push(`<p>${paragraph.map(renderMarkdownInline).join("<br>")}</p>`);
		paragraph = [];
	};
	const flushList = () => {
		if (!listType) return;
		html.push(`</${listType}>`);
		listType = null;
	};
	const ensureList = (nextType) => {
		flushParagraph();
		if (listType === nextType) return;
		flushList();
		html.push(`<${nextType}>`);
		listType = nextType;
	};

	lines.forEach((line) => {
		const trimmed = line.trim();
		if (!trimmed) {
			flushParagraph();
			flushList();
			return;
		}
		const heading = trimmed.match(/^(#{1,3})\s+(.+)$/);
		if (heading) {
			flushParagraph();
			flushList();
			const level = heading[1].length + 2;
			html.push(`<h${level}>${renderMarkdownInline(heading[2])}</h${level}>`);
			return;
		}
		const unordered = trimmed.match(/^[-*]\s+(.+)$/);
		if (unordered) {
			ensureList("ul");
			html.push(`<li>${renderMarkdownInline(unordered[1])}</li>`);
			return;
		}
		const ordered = trimmed.match(/^\d+\.\s+(.+)$/);
		if (ordered) {
			ensureList("ol");
			html.push(`<li>${renderMarkdownInline(ordered[1])}</li>`);
			return;
		}
		const quote = trimmed.match(/^>\s+(.+)$/);
		if (quote) {
			flushParagraph();
			flushList();
			html.push(`<blockquote>${renderMarkdownInline(quote[1])}</blockquote>`);
			return;
		}
		flushList();
		paragraph.push(trimmed);
	});

	flushParagraph();
	flushList();
	return html.join("");
}

function buildMarkdownNoteContent(text) {
	const content = document.createElement("div");
	content.className = "note-markdown text-sm md:text-xs";
	content.innerHTML = renderMarkdownToHtml(text);
	return content;
}

function buildNoteCardHeading({ label, variant }) {
	const heading = document.createElement("div");
	heading.className = `note-card-heading note-card-heading--${variant}`;
	heading.setAttribute("aria-label", label);

	const icon = document.createElement("span");
	icon.className = "note-card-heading-icon";
	icon.textContent = "";
	icon.setAttribute("aria-hidden", "true");

	const labelEl = document.createElement("span");
	labelEl.className = "note-card-heading-text";
	labelEl.textContent = label;

	heading.appendChild(icon);
	heading.appendChild(labelEl);
	return heading;
}

function buildAITrainerNoteHeading() {
	return buildNoteCardHeading({ label: "Trainer Chat", variant: "trainer" });
}

function buildUserNoteHeading() {
	return buildNoteCardHeading({ label: "YOUR NOTE", variant: "user" });
}

function buildNoteNutritionChips(calorieEntry) {
	const chipSpecs = [
		["Protein", calorieEntry?.macros?.protein, "g"],
		["Carbs", calorieEntry?.macros?.carbs, "g"],
		["Fat", calorieEntry?.macros?.fat, "g"],
		["Sodium", calorieEntry?.micros?.sodium, "mg"],
		["Potassium", calorieEntry?.micros?.potassium, "mg"],
		["Calcium", calorieEntry?.micros?.calcium, "mg"],
		["Iron", calorieEntry?.micros?.iron, "mg"],
		["Magnesium", calorieEntry?.micros?.magnesium, "mg"],
		["Zinc", calorieEntry?.micros?.zinc, "mg"],
		["Vitamin A", calorieEntry?.vitamins?.vitaminA, "mcg"],
		["Vitamin C", calorieEntry?.vitamins?.vitaminC, "mg"],
		["Vitamin D", calorieEntry?.vitamins?.vitaminD, "mcg"],
		["Vitamin B6", calorieEntry?.vitamins?.vitaminB6, "mg"],
		["Vitamin B12", calorieEntry?.vitamins?.vitaminB12, "mcg"],
	];
	return chipSpecs
		.filter(([, value]) => Number.isFinite(value))
		.map(([label, value, unit]) => {
			const chip = document.createElement("span");
			chip.className = "note-nutrition-chip";
			chip.textContent = `${label} ${formatNutrientValue(value, unit)}`;
			return chip;
		});
}

function buildNoteCard(note) {
	const card = document.createElement("button");
	card.type = "button";
	const isAITrainer = isAITrainerNote(note);
	const displayText = getDisplayNoteText(note);
	card.className = isAITrainer ? "note-card note-card--ai" : "note-card";
	card.dataset.noteSource = note.metadata?.source || "user";
	if (note.metadata?.marker) card.dataset.noteMarker = note.metadata.marker;
	if (isReadOnlyNote(note)) card.dataset.readonly = "true";
	card.addEventListener("click", () => openNoteEditor(note));
	card.appendChild(
		isAITrainer ? buildAITrainerNoteHeading() : buildUserNoteHeading(),
	);

	const hasCalorieEntry = Boolean(note.calorieEntry);
	if (hasCalorieEntry) {
		const entryNote = note.calorieEntry?.foodNote?.trim() || "";
		const entry = document.createElement("div");
		entry.className = "note-calorie-entry";

		const calorieBox = document.createElement("div");
		calorieBox.className = "note-calorie-box";

		const calorieValue = document.createElement("div");
		calorieValue.className = "note-calorie-value";
		const calories = note.calorieEntry?.calories;
		calorieValue.textContent = Number.isFinite(calories)
			? `${Math.round(calories)}`
			: UI_EM_DASH;

		const calorieUnit = document.createElement("div");
		calorieUnit.className = "note-calorie-unit";
		calorieUnit.textContent = "cal";

		calorieBox.appendChild(calorieValue);
		calorieBox.appendChild(calorieUnit);

		const detailWrap = document.createElement("div");
		detailWrap.className = "flex-1 flex flex-col gap-2";

		const entryText = document.createElement("div");
		entryText.className = "note-calorie-text";
		entryText.textContent = entryNote || displayText || "Nutrition entry";
		detailWrap.appendChild(entryText);

		const nutritionRow = document.createElement("div");
		nutritionRow.className = "note-nutrition-row";
		buildNoteNutritionChips(note.calorieEntry).forEach((chip) => {
			nutritionRow.appendChild(chip);
		});
		if (nutritionRow.childElementCount > 0)
			detailWrap.appendChild(nutritionRow);

		entry.appendChild(calorieBox);
		entry.appendChild(detailWrap);
		card.appendChild(entry);
		if (entryNote && displayText && displayText !== entryNote) {
			if (isAITrainer || note.metadata?.contentFormat === "markdown") {
				card.appendChild(buildMarkdownNoteContent(displayText));
			} else {
				const text = document.createElement("div");
				text.className = "text-default whitespace-pre-wrap text-sm md:text-xs";
				text.textContent = displayText;
				card.appendChild(text);
			}
		}
	} else {
		if (isAITrainer || note.metadata?.contentFormat === "markdown") {
			card.appendChild(
				buildMarkdownNoteContent(displayText || "Untitled note"),
			);
		} else {
			const text = document.createElement("div");
			text.className = "text-default whitespace-pre-wrap text-sm md:text-xs";
			text.textContent = displayText || "Untitled note";
			card.appendChild(text);
		}
	}

	const trainerConversation = parseTrainerConversationMessages(
		note.trainerResponse,
	);
	if (isAITrainer && trainerConversation.length) {
		const latestMessage = trainerConversation[trainerConversation.length - 1];
		const response = document.createElement("div");
		response.className = "note-trainer-response";
		const label = document.createElement("div");
		label.className = "note-trainer-response-label";
		label.textContent = `Conversation · ${trainerConversation.length} ${pluralize(trainerConversation.length, "message")}`;
		const text = document.createElement("div");
		text.className = "note-trainer-response-text";
		text.textContent = `${latestMessage.role === "trainer" ? "Trainer" : "You"}: ${latestMessage.content}`;
		response.appendChild(label);
		response.appendChild(text);
		card.appendChild(response);
	}

	const meta = document.createElement("div");
	meta.className = "note-meta";

	const date = document.createElement("span");
	date.textContent = getNoteTimestampLabel(note);

	const badge = document.createElement("span");
	badge.className = "note-badge";
	const isActive = Boolean(note.fastContext?.wasActive);
	const elapsedMsAtNote = note.fastContext?.elapsedMsAtNote;
	const hasElapsed = isActive && typeof elapsedMsAtNote === "number";
	if (isAITrainer) {
		badge.textContent = "AI trainer note";
		badge.classList.add("is-ai");
	} else if (isActive) {
		const typeLabel = note.fastContext?.fastTypeLabel || "fast";
		const elapsedLabel = hasElapsed
			? `${UI_BULLET_SEPARATOR}${formatElapsedShort(elapsedMsAtNote)} in`
			: "";
		badge.textContent = `Active ${typeLabel}${elapsedLabel}`;
	} else {
		badge.textContent = "No active fast";
		badge.classList.add("is-muted");
	}

	meta.appendChild(date);
	meta.appendChild(badge);

	card.appendChild(meta);
	return card;
}

function getNoteTimestampLabel(note) {
	const dateObj = parseDateKey(note.dateKey);
	if (dateObj)
		return dateObj.toLocaleDateString(undefined, {
			month: "short",
			day: "numeric",
			year: "numeric",
		});
	return "Unknown date";
}

function renderRecentFasts() {
	const container = $("recent-fast-list");
	if (!container) return;
	container.innerHTML = "";
	if (!state.history.length) {
		const p = document.createElement("p");
		p.className = "text-muted text-sm md:text-xs";
		p.textContent = "No fasts logged yet.";
		container.appendChild(p);
		return;
	}

	const recentEntries = state.history.slice(0, 10);
	const maxDuration = Math.max(
		1,
		...recentEntries.map((entry) =>
			resolveDurationHours(entry, entry.startTimestamp, entry.endTimestamp),
		),
	);
	const averageDuration =
		recentEntries.reduce(
			(sum, entry) =>
				sum +
				resolveDurationHours(entry, entry.startTimestamp, entry.endTimestamp),
			0,
		) / recentEntries.length;

	recentEntries.forEach((e) => {
		const row = document.createElement("div");
		row.className = "recent-fast-card";

		const type = getTypeById(e.typeId);
		const title = document.createElement("div");
		title.className = "history-fast-title";
		const duration = resolveDurationHours(e, e.startTimestamp, e.endTimestamp);
		title.textContent = `${type ? type.label : "Custom"}${UI_BULLET_SEPARATOR}${duration.toFixed(1)}h`;

		const start = new Date(e.startTimestamp);
		const time = document.createElement("div");
		time.className = "history-fast-subtitle";
		time.textContent = `${start.toLocaleDateString(undefined, { month: "short", day: "numeric" })}${UI_BULLET_SEPARATOR}${formatTimeShort(start)}`;

		const chartRow = document.createElement("div");
		chartRow.className = "history-chart-row";
		const compareLabel = document.createElement("div");
		compareLabel.className = "history-chart-label";
		const delta = duration - averageDuration;
		compareLabel.textContent =
			delta >= 0 ? `+${delta.toFixed(1)}h` : `${delta.toFixed(1)}h`;

		const track = document.createElement("div");
		track.className = "history-chart-track";
		const fill = document.createElement("div");
		fill.className = "history-chart-fill";
		fill.style.width = `${Math.min(100, (duration / maxDuration) * 100)}%`;
		track.appendChild(fill);
		const value = document.createElement("div");
		value.className = "history-chart-value";
		value.textContent = "vs recent";

		chartRow.appendChild(compareLabel);
		chartRow.appendChild(track);
		chartRow.appendChild(value);

		row.appendChild(title);
		row.appendChild(time);
		row.appendChild(chartRow);
		container.appendChild(row);
	});
}

function renderAll() {
	applyThemeColors();
	renderSettings();
	updateTimer();
	renderCalendar();
	renderDayDetails();
	renderNotes();
	renderRecentFasts();
	renderCalories();
}

function resolveThemePresetId() {
	const themeState = state.settings.theme || {};
	if (themeState.presetId === "custom") return "custom";
	if (themeState.presetId && THEME_PRESETS[themeState.presetId])
		return themeState.presetId;
	if (getLegacyThemeColors(themeState)) return "custom";
	return defaultState.settings.theme.presetId;
}

function getLegacyThemeColors(themeState) {
	const legacyKeys = [
		"primaryColor",
		"secondaryColor",
		"backgroundColor",
		"surfaceColor",
		"surfaceMutedColor",
		"borderColor",
		"textColor",
		"textMutedColor",
		"dangerColor",
	];
	const hasLegacy = legacyKeys.some((key) => themeState?.[key]);
	if (!hasLegacy) return null;
	return legacyKeys.reduce((acc, key) => {
		if (themeState?.[key]) acc[key] = themeState[key];
		return acc;
	}, {});
}

function getCustomThemeColors() {
	const themeState = state.settings.theme || {};
	const legacyColors = getLegacyThemeColors(themeState);
	const customColors = themeState.customColors || legacyColors || {};
	return Object.assign(
		{},
		defaultState.settings.theme.customColors,
		customColors,
	);
}

function setCustomThemeColor(key, value) {
	if (!state.settings.theme) state.settings.theme = {};
	state.settings.theme.presetId = "custom";
	state.settings.theme.customColors = Object.assign(
		{},
		getCustomThemeColors(),
		{ [key]: value },
	);
}

function setThemePreset(presetId) {
	if (!state.settings.theme) state.settings.theme = {};
	if (presetId === "custom") {
		state.settings.theme.presetId = "custom";
		state.settings.theme.customColors = getCustomThemeColors();
		return;
	}
	state.settings.theme.presetId = THEME_PRESETS[presetId]
		? presetId
		: defaultState.settings.theme.presetId;
}

function applyThemeColors() {
	const theme = getThemeSettings();
	const root = document.documentElement;
	root.style.setProperty("--primary-color", theme.primaryColor);
	root.style.setProperty("--secondary-color", theme.secondaryColor);
	root.style.setProperty("--background-color", theme.backgroundColor);
	root.style.setProperty("--surface-color", theme.surfaceColor);
	root.style.setProperty("--surface-muted-color", theme.surfaceMutedColor);
	root.style.setProperty("--border-color", theme.borderColor);
	root.style.setProperty("--text-color", theme.textColor);
	root.style.setProperty("--text-muted-color", theme.textMutedColor);
	root.style.setProperty("--danger-color", theme.dangerColor);
	const meta = document.querySelector("meta[name='theme-color']");
	if (meta) meta.setAttribute("content", theme.backgroundColor);
}

function getThemeSettings() {
	const presetId = resolveThemePresetId();
	if (presetId !== "custom" && THEME_PRESETS[presetId]) {
		return Object.assign({}, THEME_PRESETS[presetId].colors);
	}
	return getCustomThemeColors();
}

function toLocalInputValue(d) {
	const pad = (n) => String(n).padStart(2, "0");
	const yyyy = d.getFullYear();
	const mm = pad(d.getMonth() + 1);
	const dd = pad(d.getDate());
	const hh = pad(d.getHours());
	const mi = pad(d.getMinutes());
	return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

function formatHMS(ms) {
	const total = Math.max(0, Math.floor(ms / 1000));
	const h = Math.floor(total / 3600);
	const m = Math.floor((total % 3600) / 60);
	const s = total % 60;
	return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function formatElapsedShort(ms) {
	const totalMinutes = Math.max(0, Math.floor(ms / 60000));
	const hours = Math.floor(totalMinutes / 60);
	const minutes = totalMinutes % 60;
	if (hours <= 0) return `${minutes}m`;
	return `${hours}h ${minutes}m`;
}

function formatDateTime(d) {
	return d.toLocaleString(undefined, {
		month: "short",
		day: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	});
}

function formatTimeShort(d) {
	return d.toLocaleTimeString(undefined, {
		hour: "2-digit",
		minute: "2-digit",
	});
}

function startOfMonth(d) {
	return new Date(d.getFullYear(), d.getMonth(), 1);
}
function getDaysInMonth(d) {
	return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
}
function addMonths(d, amount) {
	return new Date(d.getFullYear(), d.getMonth() + amount, 1);
}

function formatDateKey(d) {
	const y = d.getFullYear();
	const m = String(d.getMonth() + 1).padStart(2, "0");
	const day = String(d.getDate()).padStart(2, "0");
	return `${y}-${m}-${day}`;
}

function parseDateKey(dateKey) {
	if (!dateKey) return null;
	const parts = dateKey.split("-");
	if (parts.length !== 3) return null;
	const [y, m, d] = parts.map(Number);
	if (!y || !m || !d) return null;
	return new Date(y, m - 1, d);
}

async function registerServiceWorker() {
	if (!("serviceWorker" in navigator)) return;
	try {
		swReg = await navigator.serviceWorker.register("./sw.js");
	} catch {}
}
