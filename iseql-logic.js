document.addEventListener("DOMContentLoaded", () => {
  // ==========================================
  // 1. INITIALIZATION & MOCK DATABASE
  // ==========================================

  updateDropdowns();

  // Initialize UI on load
  ["op1", "op2"].forEach((prefix) => {
    updateSchemaInfoBox(prefix);
    renderArgumentInputs(prefix); // <--- NEW: Generate inputs on load
  });

  const saveBtn = document.getElementById("save-event-btn");
  if (saveBtn) {
    saveBtn.addEventListener("click", () => {
      const eventName = document.getElementById("event-name").value;
      if (!eventName) return alert("Name required.");

      // 1. Capture the Dynamic Schema defined in Step 4
      let outputSchema = [];
      let argCounter = 1; // Start counting generic arguments

      document.querySelectorAll(".proj-row").forEach((row) => {
        const source = row.querySelector(".proj-source").value;
        const userAlias = row.querySelector(".proj-alias").value;

        let finalId = "";

        if (userAlias && userAlias.trim() !== "") {
          // If user typed "Giver", use "Giver"
          finalId = userAlias;
        } else {
          // If empty, auto-assign "arg1", "arg2", "arg3"...
          finalId = `arg${argCounter}`;
          argCounter++;
        }

        // Save this schema
        outputSchema.push({ id: finalId, label: userAlias || finalId });
      });
      // 2. Save
      const eventData = {
        name: eventName,
        outputSchema: outputSchema,
        date: new Date().toISOString(),
      };

      let library = JSON.parse(localStorage.getItem("iseql_library") || "[]");

      if (library.find((e) => e.name === eventName)) {
        alert("An event with this name already exists.");
        return;
      }

      library.push(eventData);
      localStorage.setItem("iseql_library", JSON.stringify(library));

      alert(`Saved "${eventName}" with ${outputSchema.length} output fields!`);
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

  // Listener for Dropdown Changes
  ["op1", "op2"].forEach((prefix) => {
    const select = document.getElementById(`${prefix}-predicate`);
    if (select) {
      select.addEventListener("change", function () {
        const selectedOption = this.options[this.selectedIndex];
        const inputContainer = document.getElementById(
          `${prefix}-existing-container`,
        );
        const nameInput = document.getElementById(`${prefix}-existing-name`);

        // Handle "Existing" text box visibility
        if (this.value === "EXISTING") {
          inputContainer.classList.remove("hidden");
          if (selectedOption.dataset.realName)
            nameInput.value = selectedOption.dataset.realName;
        } else {
          inputContainer.classList.add("hidden");
        }

        // Refresh all dynamic UI elements
        updateSchemaInfoBox(prefix);
        renderArgumentInputs(prefix); // <--- NEW: Rebuild inputs based on selection
        refreshAllVariableDropdowns();
      });
    }
  });

  // ==========================================
  // 2. NEW: DYNAMIC INPUT RENDERER
  // ==========================================

  function renderArgumentInputs(prefix) {
    const container = document.getElementById(`${prefix}-args-container`);
    if (!container) return;

    const schema = getSchemaForOperand(prefix);
    container.innerHTML = ""; // Clear old inputs

    schema.forEach((field) => {
      // Create a standard input group for each field in the schema
      const div = document.createElement("div");
      div.className = "input-group";
      div.innerHTML = `
            <label>${field.label} (${field.id})</label>
            <input type="text" class="dynamic-arg-input" data-field-id="${field.id}" placeholder="Filter value (optional)">
          `;
      container.appendChild(div);
    });
  }

  // ==========================================
  // 3. UI LOGIC (Steps 2 & 3)
  // ==========================================

  const relationRadios = document.getElementsByName("temp-relation");
  const seqOptions = document.getElementById("sequential-options");
  const overlapOptions = document.getElementById("overlapping-options");
  const overlapTypeSelect = document.getElementById("overlap-type");
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
      labelDelta.textContent = "Max Start Delay [δ]";
      labelEpsilon.textContent = "Max End Delay [ε]";
    } else if (type === "SP") {
      labelDelta.textContent = "Max Start Delay [δ]";
      containerEpsilon.style.display = "none";
    } else if (type === "EF") {
      document.getElementById("overlap-delta").parentElement.style.display =
        "none";
      labelEpsilon.textContent = "Max End Delay [ε]";
    } else {
      labelDelta.textContent = "Start Point Distance [δ]";
      labelEpsilon.textContent = "End Point Distance [ε]";
    }
  }

  relationRadios.forEach((r) => r.addEventListener("change", updateRelationUI));
  if (overlapTypeSelect)
    overlapTypeSelect.addEventListener("change", updateOverlapInputs);
  updateRelationUI();

  // --- CONSTRAINT BUILDER ---
  const addConstraintBtn = document.getElementById("add-constraint-btn");
  const constraintsList = document.getElementById("constraints-list");

  if (addConstraintBtn) {
    addConstraintBtn.addEventListener("click", () => {
      const row = document.createElement("div");
      row.className = "constraint-row input-group";
      row.style.display = "flex";
      row.style.gap = "5px";
      row.style.marginBottom = "10px";

      const variableOptionsHTML = generateVariableOptionsHTML();

      row.innerHTML = `
            <select class="c-op1" style="flex:1">${variableOptionsHTML}</select>
            <select class="c-operator" style="width:60px">
                <option value="=">=</option>
                <option value="!=">!=</option>
                <option value="<">&lt;</option>
                <option value=">">&gt;</option>
                <option value="<=">&le;</option>
                <option value=">=">&ge;</option>
            </select>
            <select class="c-op2" style="flex:1">${variableOptionsHTML}</select>
            <input type="text" class="c-modifier" placeholder="+0" style="width:50px; text-align:center;">
            <button class="btn remove-btn" style="background:#e74c3c; width:auto; padding: 0 10px;">X</button>
        `;
      row
        .querySelector(".remove-btn")
        .addEventListener("click", () => row.remove());
      constraintsList.appendChild(row);
    });
    addConstraintBtn.click();
  }

  // --- PROJECTION BUILDER ---
  const addProjBtn = document.getElementById("add-proj-btn");
  const projList = document.getElementById("projection-list");

  if (addProjBtn) {
    addProjBtn.addEventListener("click", () => {
      addProjectionRow();
    });
  }

  function addProjectionRow(defaultValue = null, defaultLabel = "") {
    const row = document.createElement("div");
    row.className = "proj-row input-group";
    row.style.display = "flex";
    row.style.gap = "10px";
    row.style.marginBottom = "10px";
    const optionsHTML = generateVariableOptionsHTML();

    row.innerHTML = `
        <select class="proj-source" style="flex:2">${optionsHTML}</select>
        <input type="text" class="proj-alias" placeholder="Alias (e.g. Giver)" style="flex:1" value="${defaultLabel}">
        <button class="btn remove-btn" style="background:#e74c3c; width:auto; padding: 0 10px;">X</button>
    `;

    if (defaultValue) row.querySelector(".proj-source").value = defaultValue;
    row
      .querySelector(".remove-btn")
      .addEventListener("click", () => row.remove());
    projList.appendChild(row);
  }

  setTimeout(() => {
    if (projList && projList.children.length === 0) {
      addProjectionRow("M1.arg1", "arg1");
      addProjectionRow("M2.arg1", "arg2");
      addProjectionRow("M1.arg2", "arg3");
    }
  }, 100);

  // ==========================================
  // 4. GENERATION LOGIC (UPDATED)
  // ==========================================

  document
    .getElementById("generate-btn")
    .addEventListener("click", generateISEQL);

  function generateISEQL() {
    const op1 = buildOperandString("op1", "M1");
    const op2 = buildOperandString("op2", "M2");

    let operatorString = "";
    const relationType = document.querySelector(
      'input[name="temp-relation"]:checked',
    ).value;

    if (relationType === "sequential") {
      const order = document.getElementById("seq-order").value;
      const gap = document.getElementById("seq-max-gap").value;
      let opCode = order === "before" ? "Bef" : "Aft";
      operatorString =
        gap && gap.trim() !== "" ? `${opCode}_{δ=${gap}}` : `${opCode}_{δ=d}`;
    } else {
      const type = overlapTypeSelect.value;
      const delta = document.getElementById("overlap-delta").value;
      const epsilon = document.getElementById("overlap-epsilon").value;
      let params = [];
      const dVal = delta ? delta : "d";
      const eVal = epsilon ? epsilon : "d";

      if (type === "DJ") {
        params.push(`δ=${dVal}`);
        params.push(`ε=${eVal}`);
      } else if (type === "SP") {
        params.push(`δ=${dVal}`);
      } else if (type === "EF") {
        params.push(`ε=${eVal}`);
      } else {
        params.push(`δ=${dVal}`);
        params.push(`ε=${eVal}`);
      } // LOJ

      operatorString = `${type}_{${params.join(", ")}}`;
    }

    let constraints = [];
    document.querySelectorAll(".constraint-row").forEach((row) => {
      const left = row.querySelector(".c-op1").value;
      const op = row.querySelector(".c-operator").value;
      const right = row.querySelector(".c-op2").value;
      const mod = row.querySelector(".c-modifier").value;
      let rightSide = right;
      if (mod && mod !== "+0" && mod.trim() !== "") {
        rightSide = `${right} ${mod}`;
      }
      constraints.push(`${left} ${op} ${rightSide}`);
    });
    const constraintString =
      constraints.length > 0 ? constraints.join(" ∧ ") : "True";

    let projParts = [];
    let returnTypes = [];
    // 1. Arguments (from Step 4)
    let argCounter = 1;

    document.querySelectorAll(".proj-row").forEach((row) => {
      const source = row.querySelector(".proj-source").value;
      const userAlias = row.querySelector(".proj-alias").value;

      let finalAlias = "";

      if (userAlias && userAlias.trim() !== "") {
        finalAlias = userAlias;
      } else {
        finalAlias = `arg${argCounter}`;
        argCounter++;
      }

      projParts.push(`${source} AS ${finalAlias}`);
      returnTypes.push(`${finalAlias} varchar`);
    });
    const sfSource = document.getElementById("proj-start-source").value;
    const efSource = document.getElementById("proj-end-source").value;
    projParts.push(sfSource);
    projParts.push(efSource);
    returnTypes.push("sf integer");
    returnTypes.push("ef integer");

    const projectionFields = projParts.join(", ");
    const returnSig = returnTypes.join(", ");
    const isExclusion = document.getElementById("exclusion-mode").checked;

    let finalExpression = "";
    if (isExclusion) {
      // Formatted for Unattended Package (Set Difference)
      finalExpression = `
π_{ ${projectionFields} } (
  ( 
    ${op1} 
  ) 
  MINUS 
  ( 
    ${op2} 
  ) 
  WHERE ${constraintString}
)`;
    } else {
      // Formatted for Standard Events (BDPE, etc.)
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
    const finalOutput = `-- ISEQL Definition for ${eventName}
CREATE OR REPLACE FUNCTION ${eventName} (source VARCHAR) 
RETURNS TABLE (${returnSig}) AS $$
BEGIN
    RETURN QUERY 
    SELECT * FROM 
    ${finalExpression};
END;
$$ LANGUAGE plpgsql;`;

    document.getElementById("output-area").value = finalOutput;
  }

  // --- UPDATED HELPER FUNCTIONS ---

  function buildOperandString(prefix, label) {
    const pred = document.getElementById(`${prefix}-predicate`).value;
    let constraints = [];

    // 1. Gather constraints from the new Dynamic Inputs
    const container = document.getElementById(`${prefix}-args-container`);
    if (container) {
      container.querySelectorAll(".dynamic-arg-input").forEach((input) => {
        if (input.value && input.value.trim() !== "") {
          const fieldId = input.dataset.fieldId;
          constraints.push(`${fieldId}="${input.value}"`);
        }
      });
    }

    // 2. Handle EXISTING saved events
    if (pred === "EXISTING") {
      const existName =
        document.getElementById(`${prefix}-existing-name`).value || "EventX";
      // If user typed constraints (e.g. Giver="p1"), wrap the event in a Selection
      if (constraints.length > 0) {
        return `σ_{ ${constraints.join(" ∧ ")} }(${existName}(${label}))`;
      } else {
        return `${existName}(${label})`;
      }
    }

    // 3. Handle Standard Predicates (in, hasPkg)
    // We add the predicate itself as the first constraint
    constraints.unshift(`pred="${pred}"`);
    return `σ_{ ${constraints.join(" ∧ ")} }(${label})`;
  }

  function getSchemaForOperand(prefix) {
    const predSelect = document.getElementById(`${prefix}-predicate`);
    if (!predSelect) return [];

    const val = predSelect.value;
    // Default Schema for basic predicates
    let schema = [
      { id: "arg1", label: "Arg1" },
      { id: "arg2", label: "Arg2" },
    ];

    if (val === "EXISTING") {
      const selectedOpt = predSelect.options[predSelect.selectedIndex];
      const realName = selectedOpt.dataset.realName;
      const library = JSON.parse(localStorage.getItem("iseql_library") || "[]");
      const savedEvent = library.find((e) => e.name === realName);

      if (savedEvent && savedEvent.outputSchema) {
        schema = savedEvent.outputSchema;
      } else {
        // Fallback schema for older saved events
        schema = [
          { id: "arg1", label: "Arg1" },
          { id: "arg2", label: "Arg2" },
          { id: "arg3", label: "Arg3" },
        ];
      }
    }
    return schema;
  }

  function generateVariableOptionsHTML() {
    let html = "";

    // Helper to format options cleanly: "M1.arg1" instead of "M1.arg1 (arg1)"
    const formatOption = (prefix, field) => {
      // value is what the logic uses (M1.arg1)
      // text is what you see (M1.arg1)
      return `<option value="${prefix}.${field.id}">${prefix}.${field.label}</option>`;
    };

    const m1Schema = getSchemaForOperand("op1");
    html += `<optgroup label="M1 Variables">`;
    m1Schema.forEach((field) => {
      html += formatOption("M1", field);
    });
    html += `<option value="M1.sf">M1 Start Frame</option>`;
    html += `<option value="M1.ef">M1 End Frame</option>`;
    html += `</optgroup>`;

    const m2Schema = getSchemaForOperand("op2");
    html += `<optgroup label="M2 Variables">`;
    m2Schema.forEach((field) => {
      html += formatOption("M2", field);
    });
    html += `<option value="M2.sf">M2 Start Frame</option>`;
    html += `<option value="M2.ef">M2 End Frame</option>`;
    html += `</optgroup>`;

    return html;
  }
  function updateSchemaInfoBox(prefix) {
    const schema = getSchemaForOperand(prefix);
    const displayDiv = document.getElementById(`${prefix}-schema-display`);
    if (!displayDiv) return;

    if (schema.length > 0) {
      const desc = schema.map((s) => `<b>${s.id}</b>: ${s.label}`).join(", ");
      displayDiv.innerHTML = `Output Schema: ${desc}`;
      displayDiv.classList.remove("hidden");
    } else {
      displayDiv.classList.add("hidden");
    }
  }

  function refreshAllVariableDropdowns() {
    const newOptions = generateVariableOptionsHTML();
    document.querySelectorAll(".c-op1, .c-op2").forEach((select) => {
      const currentVal = select.value;
      select.innerHTML = newOptions;
      select.value = currentVal;
    });
    document.querySelectorAll(".proj-source").forEach((select) => {
      const currentVal = select.value;
      select.innerHTML = newOptions;
      select.value = currentVal;
    });
  }
});
