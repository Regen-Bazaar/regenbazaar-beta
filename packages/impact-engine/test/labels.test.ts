import { test } from "node:test";
import assert from "node:assert/strict";
import { actionLabel, actionPhrase } from "../src/labels.ts";

test("labels drop the unit already named in the action type", () => {
  assert.equal(actionLabel("waste_collected_kg"), "Waste collected");
  assert.equal(actionLabel("volunteers_mobilized"), "Volunteers mobilized");
  assert.equal(actionLabel("co2_offset_ton"), "CO2 offset");
  assert.equal(actionLabel("clean_water_access_people"), "Clean water access");
});

test("phrases never repeat the unit", () => {
  assert.equal(actionPhrase({ actionType: "volunteers_mobilized", quantity: 25, unit: "volunteers" }), "Volunteers mobilized: 25 volunteers");
  assert.equal(actionPhrase({ actionType: "workshops_held", quantity: 1, unit: "workshop" }), "Workshops held: 1 workshop");
  assert.equal(actionPhrase({ actionType: "waste_collected_kg", quantity: 420, unit: "kg" }), "Waste collected: 420 kg");
  assert.equal(
    actionPhrase({ actionType: "mangroves_planted", quantity: 1500, unit: "seedlings", areaHa: 0.6, survivalRate: 0.8 }),
    "Mangroves planted: 1,500 seedlings on 0.6 ha, 80% survived",
  );
  assert.equal(actionPhrase({ actionType: "trees_planted", quantity: 30 }), "Trees planted: 30");
});
