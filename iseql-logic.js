document.addEventListener("DOMContentLoaded", () => {
  // ==========================================
  // 1. INITIALIZATION & MOCK DATABASE
  // ==========================================

  // Initialize dropdowns with saved events on page load
  updateDropdowns();

  // Listener for Saving Events
  const saveBtn = document.getElementById("save-event-btn");
  if (saveBtn) {
    saveBtn.addEventListener("click", () => {
      const eventName = document.getElementById("event-name").value;

      if (!eventName) {
        alert("Please name your event in Step 0 before saving.");
        return;
      }

      const eventData = { name: eventName, date: new Date().toISOString() };
      let library = JSON.parse(localStorage.getItem("iseql_library") || "[]");

      if (library.find((e) => e.name === eventName)) {
        alert(
          "An event with this name already exists! Please choose a unique name.",
        );
        return;
      }

      library.push(eventData);
      localStorage.setItem("iseql_library", JSON.stringify(library));
      alert(`Event "${eventName}" saved to browser storage!`);
      updateDropdowns();
    });
  }

  function updateDropdowns() {
    const library = JSON.parse(localStorage.getItem("iseql_library") || "[]");
    const selectors = [
      document.getElementById("op1-predicate"),
      document.getElementById("op2-predicate"),
    ];

    selectors.forEach((select) => {
      select.querySelectorAll(".dynamic-option").forEach((opt) => opt.remove());

      if (library.length > 0) {
        const separator = document.createElement("option");
        separator.textContent = "--- SAVED EVENTS ---";
        separator.disabled = true;
        separator.className = "dynamic-option";
        select.appendChild(separator);

        library.forEach((evt) => {
          const option = document.createElement("option");
          option.value = "EXISTING";
          option.textContent = `Event: ${evt.name}`;
          option.dataset.realName = evt.name;
          option.className = "dynamic-option";
          select.appendChild(option);
        });
      }
    });
  }

  // Auto-fill existing name input when dropdown changes
  ["op1", "op2"].forEach((prefix) => {
    const select = document.getElementById(`${prefix}-predicate`);
    if (select) {
      select.addEventListener("change", function () {
        const selectedOption = this.options[this.selectedIndex];
        const inputContainer = document.getElementById(
          `${prefix}-existing-container`,
        );
        const nameInput = document.getElementById(`${prefix}-existing-name`);

        if (this.value === "EXISTING") {
          inputContainer.classList.remove("hidden");
          if (selectedOption.dataset.realName) {
            nameInput.value = selectedOption.dataset.realName;
          }
        } else {
          inputContainer.classList.add("hidden");
        }
      });
    }
  });

  // ==========================================
  // 2. UI INTERACTION LOGIC (Steps 2 & 3)
  // ==========================================

  // --- Temporal Logic (Step 2) ---
  const relationRadios = document.getElementsByName("temp-relation");
  const seqOptions = document.getElementById("sequential-options");
  const overlapOptions = document.getElementById("overlapping-options");
  const overlapTypeSelect = document.getElementById("overlap-type");

  // Labels for dynamic overlap inputs
  const labelDelta = document.getElementById("label-delta");
  const labelEpsilon = document.getElementById("label-epsilon");
  const containerEpsilon = document.getElementById("container-epsilon");

  function updateRelationUI() {
    const selected = document.querySelector(
      'input[name="temp-relation"]:checked',
    ).value;
    if (selected === "sequential") {
      seqOptions.style.display = "block";
      overlapOptions.style.display = "none";
    } else {
      seqOptions.style.display = "none";
      overlapOptions.style.display = "block";
      updateOverlapInputs();
    }
  }

  function updateOverlapInputs() {
    const type = overlapTypeSelect.value;
    containerEpsilon.style.display = "block";
    document.getElementById("overlap-delta").parentElement.style.display =
      "block";

    if (type === "DJ") {
      // During Join
      labelDelta.textContent = "Max Start Delay [δ]";
      labelEpsilon.textContent = "Max End Delay [ε]";
    } else if (type === "SP") {
      // Start Preceding
      labelDelta.textContent = "Max Start Delay (Frames) [δ]";
      containerEpsilon.style.display = "none";
    } else if (type === "EF") {
      // End Following
      document.getElementById("overlap-delta").parentElement.style.display =
        "none";
      labelEpsilon.textContent = "Max End Delay (Frames) [ε]";
    } else {
      // LOJ
      labelDelta.textContent = "Start Point Distance [δ]";
      labelEpsilon.textContent = "End Point Distance [ε]";
    }
  }

  relationRadios.forEach((r) => r.addEventListener("change", updateRelationUI));
  if (overlapTypeSelect) {
    overlapTypeSelect.addEventListener("change", updateOverlapInputs);
  }

  // Initialize UI State
  updateRelationUI();

  // --- Constraints Builder (Step 3) - THIS WAS MISSING ---
  const addConstraintBtn = document.getElementById("add-constraint-btn");
  const constraintsList = document.getElementById("constraints-list");

  if (addConstraintBtn) {
    addConstraintBtn.addEventListener("click", () => {
      const row = document.createElement("div");
      row.className = "constraint-row input-group";
      row.style.display = "flex";
      row.style.gap = "10px";
      row.style.marginBottom = "10px"; // Visual spacing

      row.innerHTML = `
                <select class="c-op1" style="flex:1">
                    <option value="M1.arg1">M1 Arg1 (Person 1)</option>
                    <option value="M1.arg2">M1 Arg2 (Object 1)</option>
                </select>
                <select class="c-operator" style="width:80px">
                    <option value="=">=</option>
                    <option value="!=">!=</option>
                </select>
                <select class="c-op2" style="flex:1">
                    <option value="M2.arg1">M2 Arg1 (Person 2)</option>
                    <option value="M2.arg2">M2 Arg2 (Object 2)</option>
                </select>
                <button class="btn remove-btn" style="background:#e74c3c; width:auto; padding: 5px 10px;">X</button>
            `;

      // Allow removing the row
      row
        .querySelector(".remove-btn")
        .addEventListener("click", () => row.remove());
      constraintsList.appendChild(row);
    });

    // Add one default row so the list isn't empty on load
    addConstraintBtn.click();
  }

  // ==========================================
  // 3. GENERATION LOGIC (Step 4)
  // ==========================================

  document
    .getElementById("generate-btn")
    .addEventListener("click", generateISEQL);

  function generateISEQL() {
    // 1. Build Operands
    const op1 = buildOperandString("op1", "M1");
    const op2 = buildOperandString("op2", "M2");

    // 2. Determine Operator
    let operatorString = "";
    const relationType = document.querySelector(
      'input[name="temp-relation"]:checked',
    ).value;

    if (relationType === "sequential") {
      const order = document.getElementById("seq-order").value;
      const gap = document.getElementById("seq-max-gap").value;
      let opCode = order === "before" ? "Bef" : "Aft";

      // Logic: "Before" means M1 is first, "After" means M2 is first.
      // If Bef: Sequence is M1 -> M2.
      // If Aft: Sequence is M2 -> M1 (Logic in text is M2 Aft M1 implies M2 starts after M1 ends).
      // For simplicity in this tool, we assume M1 OP M2.

      if (gap && gap.trim() !== "") {
        operatorString = `${opCode}_{δ=${gap}}`;
      } else {
        operatorString = opCode;
      }
    } else {
      // Overlapping Logic
      const type = overlapTypeSelect.value;
      const delta = document.getElementById("overlap-delta").value;
      const epsilon = document.getElementById("overlap-epsilon").value;
      let params = [];

      if (type === "DJ") {
        if (delta) params.push(`δ=${delta}`);
        if (epsilon) params.push(`ε=${epsilon}`);
      } else if (type === "SP") {
        if (delta) params.push(`δ=${delta}`);
      } else if (type === "EF") {
        if (epsilon) params.push(`ε=${epsilon}`);
      } else {
        // LOJ
        if (delta) params.push(`δ=${delta}`);
        if (epsilon) params.push(`ε=${epsilon}`);
      }

      if (params.length > 0) {
        operatorString = `${type}_{${params.join(", ")}}`;
      } else {
        operatorString = type;
      }
    }

    // 3. Build Constraints
    let constraints = [];
    document.querySelectorAll(".constraint-row").forEach((row) => {
      const left = row.querySelector(".c-op1").value;
      const op = row.querySelector(".c-operator").value;
      const right = row.querySelector(".c-op2").value;
      constraints.push(`${left} ${op} ${right}`);
    });
    const constraintString =
      constraints.length > 0 ? constraints.join(" ∧ ") : "True";

    // 4. Final Assembly & PROJECTION
    const isExclusion = document.getElementById("exclusion-mode").checked;
    let finalExpression = "";

    // Standard Projection: Actors from both events, the object (usually Arg2), and the full time span.
    // matches the form in Figure 3 of the paper.
    const projectionFields = "M1.arg1, M2.arg1, M1.arg2, M1.sf, M2.ef";

    if (isExclusion) {
      // Set Difference implies keeping M1 tuples that don't match M2
      // So we project M1's attributes.
      finalExpression = `
π_{ M1.arg1, M1.arg2, M1.sf, M1.ef } (
  ( ${op1} ) 
  MINUS 
  ( ${op2} ) 
  WHERE ${constraintString}
)`;
    } else {
      // Standard Join
      finalExpression = `
π_{ ${projectionFields} } (
  σ_{ ${constraintString} } (
    ${op1} 
    ${operatorString} 
    ${op2}
  ) 
)`;
    }

    const eventName =
      document.getElementById("event-name").value || "UnnamedEvent";

    // Output as PL/pgSQL Function signature
    const finalOutput = `-- ISEQL Definition for ${eventName}
CREATE OR REPLACE FUNCTION ${eventName} (source VARCHAR) 
RETURNS TABLE (arg1 varchar, arg2 varchar, obj varchar, sf integer, ef integer) AS $$
BEGIN
    -- Logic generated from User Input
    -- Relationship: ${relationType === "sequential" ? "Sequential" : "Overlapping"}
    RETURN QUERY 
    SELECT * FROM 
    ${finalExpression};
END;
$$ LANGUAGE plpgsql;`;

    document.getElementById("output-area").value = finalOutput;
  }
  function buildOperandString(prefix, label) {
    const pred = document.getElementById(`${prefix}-predicate`).value;
    if (pred === "EXISTING") {
      const existName =
        document.getElementById(`${prefix}-existing-name`).value || "EventX";
      return `${existName}(${label})`;
    }
    const arg1 = document.getElementById(`${prefix}-arg1`).value;
    const arg2 = document.getElementById(`${prefix}-arg2`).value;
    let parts = [`pred="${pred}"`];
    if (arg1) parts.push(`arg1="${arg1}"`);
    if (arg2) parts.push(`arg2="${arg2}"`);
    return `σ_{ ${parts.join(" ∧ ")} }(${label})`;
  }
});
