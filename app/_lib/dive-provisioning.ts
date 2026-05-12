import { readFile } from "fs/promises";
import { join } from "path";
import { createHash, randomUUID } from "crypto";
import {
  getAppSetting,
  insertAnonymousEditSession,
  setAppSetting,
} from "./db";
import { createMotherDuckUser } from "@/lib/motherduck/api";
import {
  createDiveEmbedSessionForAccess,
  getMotherduckPg,
  serviceAccountAccess,
  type AppMotherDuckAccess,
} from "@/app/_lib/motherduck-access";
import {
  createEditSessionSecret,
  getEditSessionMotherDuckAccess,
  getEditSessionDiveIds,
  getSharedServiceAccountUsername,
  hashEditSessionSecret,
} from "./auth";
import type { EditSessionRow } from "./db";
import { mdStringLiteral } from "@/lib/motherduck/sql";

const DEFAULT_STARTER_KEY = "presentation-dive";

export type StarterDiveKey =
  | "dashboard-dive"
  | "game-dive"
  | "presentation-dive";

export type StarterDive = {
  key: StarterDiveKey;
  title: string;
  label: string;
  description: string;
  file: string;
};

export type ProvisionedStarterDive = StarterDive & {
  diveId: string;
};

export type GalleryDive = {
  key: string;
  title: string;
  label: string;
  description: string;
  file?: string;
  diveId: string;
  session: string;
  starterKey?: StarterDiveKey;
  updatedAt?: string | null;
};

type AccountDiveRow = {
  id: string;
  title: string | null;
  description: string | null;
  updated_at: string | null;
};

export const STARTER_DIVES: StarterDive[] = [
  {
    key: "presentation-dive",
    title: "NYC 311 Slide Deck",
    label: "Slides",
    description: "A presentation-dive, showing service request volume, borough mix, and trend shifts.",
    file: "presentation-dive.tsx",
  },
  {
    key: "dashboard-dive",
    title: "NYC Service Operations Pulse",
    label: "Dashboard",
    description: "Interactive KPI dashboard with row-level inspection and drilldowns.",
    file: "dashboard-dive.tsx",
  },
  {
    key: "game-dive",
    title: "NYC 311 Faceoff",
    label: "Game",
    description: "A game-dive learning issue volume patterns and borough differences..",
    file: "game-dive.tsx",
  },
];

let starterSetupPromise: Promise<ProvisionedStarterDive[]> | null = null;
let starterSetupSignature: string | null = null;

function normalizeStarterKey(key?: string | null): StarterDiveKey {
  return STARTER_DIVES.some((dive) => dive.key === key)
    ? (key as StarterDiveKey)
    : DEFAULT_STARTER_KEY;
}

async function getStarterDiveContent(starter: StarterDive): Promise<string> {
  return readFile(join(process.cwd(), "dives", starter.file), "utf-8");
}

async function createDiveForUser(
  username: string,
  title: string,
  description: string,
  content: string
): Promise<string> {
  const sql = await getMotherduckPg(serviceAccountAccess(username));
  const rows = await sql.unsafe(`
    SELECT id
    FROM MD_CREATE_DIVE(
      title = ${mdStringLiteral(title)},
      content = ${mdStringLiteral(content)},
      description = ${mdStringLiteral(description)}
    )
  `);
  return rows[0].id as string;
}

async function createStarterDiveForUser(
  username: string,
  starter: StarterDive,
  title: string = starter.title,
  description: string = starter.description,
  content?: string
): Promise<string> {
  const starterContent = content ?? (await getStarterDiveContent(starter));
  return createDiveForUser(username, title, description, starterContent);
}

async function updateDiveContent(
  username: string,
  diveId: string,
  content: string
): Promise<void> {
  const sql = await getMotherduckPg(serviceAccountAccess(username));
  await sql.unsafe(`
    SELECT *
    FROM MD_UPDATE_DIVE_CONTENT(id = ${mdStringLiteral(diveId)}, content = ${mdStringLiteral(content)})
  `);
}

function hashContent(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

async function getStarterContentSignature(): Promise<string> {
  const hash = createHash("sha256");
  for (const starter of STARTER_DIVES) {
    hash.update(starter.key);
    hash.update(await getStarterDiveContent(starter));
  }
  return hash.digest("hex");
}

async function setupStarterDives(): Promise<ProvisionedStarterDive[]> {
  const sourceUsername = getSharedServiceAccountUsername();
  await createMotherDuckUser(sourceUsername);

  const sql = await getMotherduckPg(serviceAccountAccess(sourceUsername));
  const existingRows = await sql<{ id: string; title: string }[]>`
    SELECT id, title
    FROM MD_LIST_DIVES()
    WHERE title IN ${sql(STARTER_DIVES.map((dive) => dive.title))}
  `;
  const existingByTitle = new Map(
    existingRows.map((row) => [row.title, row.id])
  );

  const provisioned: ProvisionedStarterDive[] = [];
  for (const starter of STARTER_DIVES) {
    const content = await getStarterDiveContent(starter);
    const contentHash = hashContent(content);
    const idKey = `source_dive_id:${sourceUsername}:${starter.key}`;
    const hashKey = `source_dive_hash:${sourceUsername}:${starter.key}`;
    const existing = (await getAppSetting(idKey)) ?? existingByTitle.get(starter.title);
    const diveId =
      existing ??
      (await createStarterDiveForUser(
        sourceUsername,
        starter,
        starter.title,
        starter.description,
        content
      ));
    const storedHash = await getAppSetting(hashKey);
    if (existing && storedHash !== contentHash) {
      await updateDiveContent(sourceUsername, diveId, content);
    }
    provisioned.push({ ...starter, diveId });
    await setAppSetting(idKey, diveId);
    await setAppSetting(hashKey, contentHash);
  }

  return provisioned;
}

export async function getStarterDives(): Promise<ProvisionedStarterDive[]> {
  const signature = await getStarterContentSignature();
  if (!starterSetupPromise || starterSetupSignature !== signature) {
    starterSetupSignature = signature;
    starterSetupPromise = setupStarterDives().catch((err) => {
      starterSetupPromise = null;
      starterSetupSignature = null;
      throw err;
    });
  }
  return starterSetupPromise;
}

export async function getOrCreateSourceDive(starterKey?: string | null): Promise<{
  diveId: string;
  username: string;
  starter: ProvisionedStarterDive;
}> {
  const starters = await getStarterDives();
  const key = normalizeStarterKey(starterKey);
  const starter = starters.find((dive) => dive.key === key) ?? starters[0];
  return { diveId: starter.diveId, username: getSharedServiceAccountUsername(), starter };
}

export async function createAnonymousCustomization(
  starterKey?: string | null
): Promise<{
  editSessionId: string;
  sessionSecret: string;
  diveId: string;
  diveIds: Record<StarterDiveKey, string>;
  sourceDiveId: string;
  sourceDiveIds: Record<StarterDiveKey, string>;
  starterKey: StarterDiveKey;
}> {
  const starters = await getStarterDives();
  const key = normalizeStarterKey(starterKey);
  const selectedStarter = starters.find((dive) => dive.key === key) ?? starters[0];
  const editSessionId = randomUUID();
  const sessionSecret = createEditSessionSecret();
  const username = `anon_${editSessionId.replace(/-/g, "_")}`;

  await createMotherDuckUser(username);

  const diveIds = {} as Record<StarterDiveKey, string>;
  const sourceDiveIds = {} as Record<StarterDiveKey, string>;
  for (const starter of starters) {
    diveIds[starter.key] = await createStarterDiveForUser(
      username,
      starter
    );
    sourceDiveIds[starter.key] = starter.diveId;
  }

  const diveId = diveIds[selectedStarter.key];
  const sourceDiveId = sourceDiveIds[selectedStarter.key];

  await insertAnonymousEditSession({
    id: editSessionId,
    secret_hash: hashEditSessionSecret(sessionSecret),
    motherduck_username: username,
    dive_ids_json: JSON.stringify(diveIds),
    source_dive_ids_json: JSON.stringify(sourceDiveIds),
    expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
  });

  return {
    editSessionId,
    sessionSecret,
    diveId,
    diveIds,
    sourceDiveId,
    sourceDiveIds,
    starterKey: selectedStarter.key,
  };
}

export async function createSourceEmbedSession(
  starterKey?: string | null
): Promise<{
  diveId: string;
  session: string;
  starterKey: StarterDiveKey;
  starters: ProvisionedStarterDive[];
}> {
  const starters = await getStarterDives();
  const source = await getOrCreateSourceDive(starterKey);
  const session = await createDiveEmbedSessionForAccess(
    source.diveId,
    serviceAccountAccess(source.username)
  );
  return {
    diveId: source.diveId,
    session,
    starterKey: source.starter.key,
    starters,
  };
}

export async function createSourceGallery(): Promise<{
  viewer: {
    kind: "demo";
    scope: "public";
    label: string;
    description: string;
  };
  dives: GalleryDive[];
}> {
  const starters = await getStarterDives();
  const sourceUsername = getSharedServiceAccountUsername();
  const sourceAccess = serviceAccountAccess(sourceUsername);
  const dives = await Promise.all(
    starters.map(async (starter) => ({
      ...starter,
      key: starter.key,
      session: await createDiveEmbedSessionForAccess(starter.diveId, sourceAccess),
      starterKey: starter.key,
    }))
  );

  return {
    viewer: {
      kind: "demo",
      scope: "public",
      label: "Guest demo",
      description: "Viewing shared source dives",
    },
    dives,
  };
}

export async function createEditSessionGallery(
  editSession: EditSessionRow
): Promise<{
  viewer: {
    kind: "demo";
    scope: "isolated";
    label: string;
    description: string;
    sessionId: string;
  };
  dives: GalleryDive[];
}> {
  const access = await getEditSessionMotherDuckAccess(editSession);
  const dives = await listAccountGalleryDives(access);

  return {
    viewer: {
      kind: "demo",
      scope: "isolated",
      label: "Isolated demo session",
      description: "Using cloned dives in session MotherDuck account",
      sessionId: editSession.id,
    },
    dives,
  };
}

async function listAccountDives(access: AppMotherDuckAccess): Promise<AccountDiveRow[]> {
  const sql = await getMotherduckPg(access);
  return await sql<AccountDiveRow[]>`
    SELECT id, title, description, updated_at
    FROM MD_LIST_DIVES()
    ORDER BY title DESC
  `;
}

async function listAccountGalleryDives(access: AppMotherDuckAccess): Promise<GalleryDive[]> {
  const rows = await listAccountDives(access);
  return await Promise.all(
    rows.map(async (row) => {
      const title = row.title?.trim() || "Untitled Dive";
      const description = row.description?.trim() || "No description.";
      return {
        key: row.id,
        title,
        label: title,
        description,
        file: "",
        diveId: row.id,
        session: await createDiveEmbedSessionForAccess(row.id, access),
        updatedAt: row.updated_at,
      };
    })
  );
}

export async function getExistingCustomization(
  editSession: EditSessionRow,
  selectedKey?: string | null,
  selectedDiveId?: string | null
): Promise<{
  editSessionId: string;
  diveId: string;
  diveIds: Record<string, string>;
  starterKey: string;
}> {
  const accountDives = await listAccountDives(
    await getEditSessionMotherDuckAccess(editSession)
  );
  const accountDiveIds = new Set(accountDives.map((dive) => dive.id));
  const storedDiveIds = getEditSessionDiveIds(editSession);
  const requestedDiveId =
    selectedDiveId && accountDiveIds.has(selectedDiveId)
      ? selectedDiveId
      : selectedKey && accountDiveIds.has(selectedKey)
        ? selectedKey
        : selectedKey && storedDiveIds[selectedKey] && accountDiveIds.has(storedDiveIds[selectedKey])
          ? storedDiveIds[selectedKey]
          : null;
  const diveId = requestedDiveId ?? accountDives[0]?.id ?? null;
  if (!diveId) {
    throw new Error("No dives available in the MotherDuck account");
  }
  const diveIds = Object.fromEntries(accountDives.map((dive) => [dive.id, dive.id]));
  return {
    editSessionId: editSession.id,
    diveId,
    diveIds,
    starterKey: diveId,
  };
}
