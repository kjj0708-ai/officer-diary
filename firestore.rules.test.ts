import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { setDoc, getDoc, doc, serverTimestamp } from "firebase/firestore";
import { readFileSync } from "fs";

let testEnv: RulesTestEnvironment;

describe("Firestore Security Rules", () => {
  beforeAll(async () => {
    testEnv = await initializeTestEnvironment({
      projectId: "project-25bbfa50-adce-447f-8db",
      firestore: {
        rules: readFileSync("firestore.rules", "utf8"),
      },
    });
  });

  afterAll(async () => {
    await testEnv.cleanup();
  });

  beforeEach(async () => {
    await testEnv.clearFirestore();
  });

  it("Identity Spoofing: should deny User A writing to User B path", async () => {
    const aliceDb = testEnv.authenticatedContext("alice").firestore();
    await assertFails(
      setDoc(doc(aliceDb, "users/bob/entries/04-23"), {
        userId: "bob",
        dateId: "04-23",
        years: { "2026": "Hello" },
        updatedAt: serverTimestamp()
      })
    );
  });

  it("Field Integrity: should deny write if userId field doesn't match auth.uid", async () => {
    const aliceDb = testEnv.authenticatedContext("alice").firestore();
    await assertFails(
      setDoc(doc(aliceDb, "users/alice/entries/04-23"), {
        userId: "bob", // Spoofing ID
        dateId: "04-23",
        years: { "2026": "Hello" },
        updatedAt: serverTimestamp()
      })
    );
  });

  it("Unauthorized Read: should deny User B reading User A entries", async () => {
    const bobDb = testEnv.authenticatedContext("bob").firestore();
    await assertFails(getDoc(doc(bobDb, "users/alice/entries/04-23")));
  });

  it("Valid Write: should allow owner to write their own entry", async () => {
    const aliceDb = testEnv.authenticatedContext("alice").firestore();
    await assertSucceeds(
      setDoc(doc(aliceDb, "users/alice/entries/04-23"), {
        userId: "alice",
        dateId: "04-23",
        years: { "2026": "Hello" },
        updatedAt: serverTimestamp()
      })
    );
  });

  it("Field Injection: should deny writing unknown fields", async () => {
    const aliceDb = testEnv.authenticatedContext("alice").firestore();
    await assertFails(
      setDoc(doc(aliceDb, "users/alice/entries/04-23"), {
        userId: "alice",
        dateId: "04-23",
        years: { "2026": "Hello" },
        updatedAt: serverTimestamp(),
        isAdmin: true // Unknown field
      })
    );
  });

  it("Bypassing Server Timestamp: should deny client-side timestamps", async () => {
    const aliceDb = testEnv.authenticatedContext("alice").firestore();
    await assertFails(
      setDoc(doc(aliceDb, "users/alice/entries/04-23"), {
        userId: "alice",
        dateId: "04-23",
        years: { "2026": "Hello" },
        updatedAt: new Date() // Client timestamp
      })
    );
  });

  it("Type Poisoning: should deny invalid field types", async () => {
    const aliceDb = testEnv.authenticatedContext("alice").firestore();
    await assertFails(
      setDoc(doc(aliceDb, "users/alice/entries/04-23"), {
        userId: "alice",
        dateId: "04-23",
        years: "not a map", // Should be a map
        updatedAt: serverTimestamp()
      })
    );
  });

  it("Shadow Path: should deny writing to root collections", async () => {
    const aliceDb = testEnv.authenticatedContext("alice").firestore();
    await assertFails(
      setDoc(doc(aliceDb, "configs/admin_settings"), {
        canWrite: true
      })
    );
  });
});
