/**
ISEQL Query Builder

Homework #2 – Artificial Intelligence

Client-side logic implementation of a visual ISEQL query builder.
Users can define events, temporal relations, constraints, projections
and, with those, generate the corresponding ISEQL definition.

Authors: Guido Maria di Fiore, Inés Shanlu Rodríguez, Carla Rubio
Instructor: Fabio Persia
**/

// Initialize UI logic once the DOM is fully loaded
document.addEventListener("DOMContentLoaded", () => {
  // Load saved events and initialize dropdowns
  updateDropdowns();
  renderSavedEventsManager();

  // Initialize operands (schemas and argument inputs)
  ["op1", "op2"].forEach(prefix => {
    updateSchemaInfoBox(prefix);
    renderArgumentInputs(prefix);
  });

  // Save current event definition and UI state
  const saveBtn = document.getElementById("save-event-btn");
  if (saveBtn) {
    saveBtn.addEventListener("click", () => {
      const eventName = document.getElementById("event-name").value;
      if (!eventName) return alert("Name required.");

      let outputSchema = [];

      document.querySelectorAll(".proj-row").forEach((row) => {
        const source = row.querySelector(".proj-source").value;
        const userAlias = row.querySelector(".proj-alias").value;

        const finalId = userAlias ? userAlias : source;

        outputSchema.push({ id: finalId, label: userAlias || finalId });
      });

      const fullText = document.getElementById("output-area").value;
      let logicDef = "";
      if (fullText.includes("SELECT * FROM")) {
        const start = fullText.indexOf("SELECT * FROM") + 13;
        const end = fullText.lastIndexOf(";");
        logicDef = fullText.substring(start, end).trim();
      }

      const uiState = {
        op1: {
          pred: document.getElementById("op1-predicate").value,
          existName: document.getElementById("op1-existing-name").value,
          args: getArgsValues("op1")
        },
        op2: {
          pred: document.getElementById("op2-predicate").value,
          existName: document.getElementById("op2-existing-name").value,
          args: getArgsValues("op2")
        },
        relation: {
          type: document.querySelector('input[name="temp-relation"]:checked').value,
          seqOrder: document.getElementById("seq-order").value,
          seqGap: document.getElementById("seq-max-gap").value,
          overlapType: document.getElementById("overlap-type").value,
          delta: document.getElementById("overlap-delta").value,
          epsilon: document.getElementById("overlap-epsilon").value
        },
        constraints: [],
        exclusion: document.getElementById("exclusion-mode").checked,
        projection: {
          start: document.getElementById("proj-start-source").value,
          end: document.getElementById("proj-end-source").value,
          fields: []
        }
      };

      document.querySelectorAll(".constraint-row").forEach(row => {
        uiState.constraints.push({
          op1: row.querySelector(".c-op1").value,
          operator: row.querySelector(".c-operator").value,
          op2: row.querySelector(".c-op2").value,
          mod: row.querySelector(".c-modifier").value
        });
      });

      document.querySelectorAll(".proj-row").forEach(row => {
        uiState.projection.fields.push({
          source: row.querySelector(".proj-source").value,
          alias: row.querySelector(".proj-alias").value
        });
      });

      const eventData = {
        name: eventName,
        outputSchema: outputSchema,
        logicDefinition: logicDef,
        uiState: uiState,
        date: new Date().toISOString(),
      };

      let library = JSON.parse(localStorage.getItem("iseql_library") || "[]");
      library = library.filter(e => e.name !== eventName);
      library.push(eventData);
      localStorage.setItem("iseql_library", JSON.stringify(library));

      alert(`Saved "${eventName}" with ${outputSchema.length} output fields!`);
      updateDropdowns();
      renderSavedEventsManager();
    });
  }

  // Get filter values entered for an operand
  function getArgsValues(prefix) {
    const vals = {};
    const container = document.getElementById(`${prefix}-args-container`);
    if (container) {
      container.querySelectorAll('input').forEach(input => {
        const fieldId = input.dataset.fieldId;
        if (input.value) vals[fieldId] = input.value;
      });
    }
    return vals;
  }

  // Update predicate dropdowns with saved events from localStorage
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

  // Handle changes in operand predicates (new vs existing event)
  ["op1", "op2"].forEach((prefix) => {
    const select = document.getElementById(`${prefix}-predicate`);
    if (select) {
      select.addEventListener("change", function () {
        const selectedOption = this.options[this.selectedIndex];
        const inputContainer = document.getElementById(`${prefix}-existing-container`);
        const nameInput = document.getElementById(`${prefix}-existing-name`);

        if (this.value === "EXISTING") {
          inputContainer.classList.remove("hidden");
          if (selectedOption.dataset.realName)
            nameInput.value = selectedOption.dataset.realName;
        } else {
          inputContainer.classList.add("hidden");
        }

        updateSchemaInfoBox(prefix);
        renderArgumentInputs(prefix);
        refreshAllVariableDropdowns();
      });
    }
  });

  // Resolve the alias used for an operand (M1 / M2 or event name)
  function getOperandAlias(prefix) {
    const predSelect = document.getElementById(`${prefix}-predicate`);
    if (!predSelect) return (prefix === 'op1' ? "M1" : "M2");

    if (predSelect.value === "EXISTING") {
      const selectedOpt = predSelect.options[predSelect.selectedIndex];
      return selectedOpt.dataset.realName || (prefix === 'op1' ? "M1" : "M2");
    }
    return (prefix === 'op1' ? "M1" : "M2");
  }

  // Get the schema associated with the selected operand
  function getSchemaForOperand(prefix) {
    const predSelect = document.getElementById(`${prefix}-predicate`);
    if (!predSelect) return [];

    const val = predSelect.value;
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
        schema = [
          { id: "arg1", label: "Arg1" },
          { id: "arg2", label: "Arg2" },
          { id: "arg3", label: "Arg3" },
        ];
      }
    }
    return schema;
  }

  // Generate variable options used in constraints and projections
  function generateVariableOptionsHTML() {
    let html = "";

    const formatOption = (prefixStr, alias, field) => {
      if (field.id.includes('.')) {
        return `<option value='"${field.id}"'>${field.label}</option>`;
      }

      return `<option value="${alias}.${field.id}">${alias}.${field.label}</option>`;
    };

    const alias1 = getOperandAlias("op1");
    const m1Schema = getSchemaForOperand("op1");
    html += `<optgroup label="${alias1} Variables">`;
    m1Schema.forEach((field) => {
      html += formatOption("op1", alias1, field);
    });
    html += `<option value="${alias1}.sf">${alias1} Start Frame</option>`;
    html += `<option value="${alias1}.ef">${alias1} End Frame</option>`;
    html += `</optgroup>`;

    const alias2 = getOperandAlias("op2");
    const m2Schema = getSchemaForOperand("op2");
    html += `<optgroup label="${alias2} Variables">`;
    m2Schema.forEach((field) => {
      html += formatOption("op2", alias2, field);
    });
    html += `<option value="${alias2}.sf">${alias2} Start Frame</option>`;
    html += `<option value="${alias2}.ef">${alias2} End Frame</option>`;
    html += `</optgroup>`;

    return html;
  }

  // Refresh all variable selectors when schemas change
  function refreshAllVariableDropdowns() {
    const newOptions = generateVariableOptionsHTML();
    document.querySelectorAll(".c-op1, .c-op2").forEach((select) => {
      select.innerHTML = newOptions;
    });
    document.querySelectorAll(".proj-source").forEach((select) => {
      select.innerHTML = newOptions;
    });
  }

  // Render input fields for operand arguments
  function renderArgumentInputs(prefix) {
    const container = document.getElementById(`${prefix}-args-container`);
    if (!container) return;

    const schema = getSchemaForOperand(prefix);
    container.innerHTML = "";

    schema.forEach(field => {
      const div = document.createElement("div");
      div.className = "input-group";
      div.innerHTML = `
            <label>${field.label} (${field.id})</label>
            <input type="text" class="dynamic-arg-input" data-field-id="${field.id}" placeholder="Filter value (optional)">
          `;
      container.appendChild(div);
    });
  }

  // Display the output schema of the selected operand
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

  const relationRadios = document.getElementsByName("temp-relation");
  const seqOptions = document.getElementById("sequential-options");
  const overlapOptions = document.getElementById("overlapping-options");
  const overlapTypeSelect = document.getElementById("overlap-type");
  const labelDelta = document.getElementById("label-delta");
  const labelEpsilon = document.getElementById("label-epsilon");
  const containerEpsilon = document.getElementById("container-epsilon");

  // Show or hide UI options depending on temporal relation
  function updateRelationUI() {
    const selected = document.querySelector('input[name="temp-relation"]:checked').value;
    if (selected === "sequential") {
      seqOptions.style.display = "block";
      overlapOptions.style.display = "none";
    } else {
      seqOptions.style.display = "none";
      overlapOptions.style.display = "block";
      updateOverlapInputs();
    }
  }

  // Update overlap parameter labels based on selected type
  function updateOverlapInputs() {
    const type = overlapTypeSelect.value;
    containerEpsilon.style.display = "block";
    document.getElementById("overlap-delta").parentElement.style.display = "block";
    if (type === "DJ" || type === "RDJ") {
      labelDelta.textContent = "Max Start Delay [δ]";
      labelEpsilon.textContent = "Max End Delay [ε]";
    } else if (type === "SP") {
      labelDelta.textContent = "Max Start Delay [δ]";
      containerEpsilon.style.display = "none";
    } else if (type === "EF") {
      document.getElementById("overlap-delta").parentElement.style.display = "none";
      labelEpsilon.textContent = "Max End Delay [ε]";
    } else if (type === "ROJ") {
      labelDelta.textContent = "Start Point Distance [δ]";
      labelEpsilon.textContent = "End Point Distance [ε]";
    } else {
      labelDelta.textContent = "Start Point Distance [δ]";
      labelEpsilon.textContent = "End Point Distance [ε]";
    }
  }

  relationRadios.forEach((r) => r.addEventListener("change", updateRelationUI));
  if (overlapTypeSelect) overlapTypeSelect.addEventListener("change", updateOverlapInputs);
  updateRelationUI();

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
      row.querySelector(".remove-btn").addEventListener("click", () => row.remove());
      constraintsList.appendChild(row);
    });
    setTimeout(() => {
      if (constraintsList.children.length === 0) addConstraintBtn.click();
    }, 200);
  }

  const addProjBtn = document.getElementById("add-proj-btn");
  const projList = document.getElementById("projection-list");

  if (addProjBtn) {
    addProjBtn.addEventListener("click", () => {
      addProjectionRow();
    });
  }

  // Add a new projection field
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
    row.querySelector(".remove-btn").addEventListener("click", () => row.remove());
    projList.appendChild(row);
  }

  setTimeout(() => {
    if (projList && projList.children.length === 0) {
      const alias1 = getOperandAlias('op1');
      const alias2 = getOperandAlias('op2');
      addProjectionRow(`${alias1}.arg1`, "arg1");
      addProjectionRow(`${alias2}.arg1`, "arg2");
    }
  }, 300);

  document.getElementById("generate-btn").addEventListener("click", generateISEQL);

  // Generate the final ISEQL query from the current UI state
  function generateISEQL() {
    const currentEventName = document.getElementById("event-name").value;
    const alias1 = getOperandAlias("op1");
    const alias2 = getOperandAlias("op2");

    const op1 = buildOperandString("op1", alias1, currentEventName);
    const op2 = buildOperandString("op2", alias2, currentEventName);

    let operatorString = "";
    const relationType = document.querySelector('input[name="temp-relation"]:checked').value;

    if (relationType === "sequential") {
      const order = document.getElementById("seq-order").value;
      const gap = document.getElementById("seq-max-gap").value;
      let opCode = order === "before" ? "Bef" : "Aft";
      operatorString = (gap && gap.trim() !== "") ? `${opCode}_{δ=${gap}}` : `${opCode}_{δ=d}`;
    } else {
      const type = overlapTypeSelect.value;
      const delta = document.getElementById("overlap-delta").value;
      const epsilon = document.getElementById("overlap-epsilon").value;
      let params = [];
      const dVal = delta ? delta : "d";
      const eVal = epsilon ? epsilon : "d";

      if (type === "DJ") { params.push(`δ=${dVal}`); params.push(`ε=${eVal}`); }
      else if (type === "SP") { params.push(`δ=${dVal}`); }
      else if (type === "EF") { params.push(`ε=${eVal}`); }
      else { params.push(`δ=${dVal}`); params.push(`ε=${eVal}`); }

      operatorString = `${type}_{${params.join(", ")}}`;
    }

    let constraints = [];
    document.querySelectorAll(".constraint-row").forEach((row) => {
      const left = row.querySelector(".c-op1").value;
      const op = row.querySelector(".c-operator").value;
      const right = row.querySelector(".c-op2").value;
      const mod = row.querySelector(".c-modifier").value;
      let rightSide = right;
      if (mod && mod !== "+0" && mod.trim() !== "") { rightSide = `${right} ${mod}`; }
      constraints.push(`${left} ${op} ${rightSide}`);
    });
    const constraintString = constraints.length > 0 ? constraints.join(" ∧ ") : "True";

    let projParts = [];
    let returnTypes = [];

    document.querySelectorAll(".proj-row").forEach((row) => {
      const source = row.querySelector(".proj-source").value;
      const alias = row.querySelector(".proj-alias").value;

      let finalAlias = "";

      if (alias && alias.trim() !== "") {
        finalAlias = alias;
      } else {
        finalAlias = `"${source.replace(/"/g, '')}"`;
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
      finalExpression = `
π_{ ${projectionFields} } (
  σ_{ ${constraintString} } (
    ${op1} 
    ${operatorString} 
    ${op2}
  ) 
)`;
    }

    const finalOutput = `-- ISEQL Definition for ${currentEventName}
CREATE OR REPLACE FUNCTION ${currentEventName} (source VARCHAR) 
RETURNS TABLE (${returnSig}) AS $$
BEGIN
    RETURN QUERY 
    SELECT * FROM 
    ${finalExpression};
END;
$$ LANGUAGE plpgsql;`;

    document.getElementById("output-area").value = finalOutput;
  }

  // Build operand expression including filters and nested events
  function buildOperandString(prefix, alias, definitionName) {
    const pred = document.getElementById(`${prefix}-predicate`).value;
    let constraints = [];

    const container = document.getElementById(`${prefix}-args-container`);
    if (container) {
      container.querySelectorAll('.dynamic-arg-input').forEach(input => {
        if (input.value && input.value.trim() !== "") {
          const fieldId = input.dataset.fieldId;
          constraints.push(`${fieldId}="${input.value}"`);
        }
      });
    }

    if (pred === "EXISTING") {
      const existName = document.getElementById(`${prefix}-existing-name`).value || "EventX";

      if (definitionName && existName === definitionName) {
        const library = JSON.parse(localStorage.getItem("iseql_library") || "[]");
        const savedEvent = library.find(e => e.name === existName);

        if (savedEvent && savedEvent.logicDefinition) {
          if (constraints.length > 0) {
            return `σ_{ ${constraints.join(" ∧ ")} } ( \n ${savedEvent.logicDefinition} \n )`;
          }
          return `( \n ${savedEvent.logicDefinition} \n )`;
        }
      }

      if (constraints.length > 0) {
        return `σ_{ ${constraints.join(" ∧ ")} }(${existName}(${alias}))`;
      } else {
        return `${existName}(${alias})`;
      }
    }

    constraints.unshift(`pred="${pred}"`);
    return `σ_{ ${constraints.join(" ∧ ")} }(${alias})`;
  }

  const deleteSavedBtn = document.getElementById("delete-saved-btn");
  if (deleteSavedBtn) {
    deleteSavedBtn.addEventListener("click", () => {
      const select = document.getElementById("saved-events-select");
      const selectedName = select.value;

      if (!selectedName) {
        alert("Please select an event to delete.");
        return;
      }

      if (confirm(`Are you sure you want to delete "${selectedName}"? This cannot be undone.`)) {
        deleteEvent(selectedName);
      }
    });
  }

  function renderSavedEventsManager() {
    const select = document.getElementById("saved-events-select");
    if (!select) return;

    const library = JSON.parse(localStorage.getItem("iseql_library") || "[]");

    select.innerHTML = "";

    if (library.length === 0) {
      const option = document.createElement("option");
      option.text = "--- No saved events ---";
      option.value = "";
      select.appendChild(option);
      select.disabled = true;
      return;
    }

    select.disabled = false;

    const defaultOption = document.createElement("option");
    defaultOption.text = "--- Select an event to manage ---";
    defaultOption.value = "";
    defaultOption.selected = true;
    defaultOption.disabled = true;
    select.appendChild(defaultOption);

    library.forEach((evt) => {
      const option = document.createElement("option");
      option.value = evt.name;
      option.text = `${evt.name} (${evt.outputSchema ? evt.outputSchema.length : 0} fields)`;
      select.appendChild(option);
    });
  }

  // Remove an event from localStorage and update the UI
  function deleteEvent(nameToDelete) {
    let library = JSON.parse(localStorage.getItem("iseql_library") || "[]");
    const newLibrary = library.filter(e => e.name !== nameToDelete);
    localStorage.setItem("iseql_library", JSON.stringify(newLibrary));

    renderSavedEventsManager();
    updateDropdowns();

    ["op1", "op2"].forEach(prefix => {
      const select = document.getElementById(`${prefix}-predicate`);
      const input = document.getElementById(`${prefix}-existing-name`);

      if (select.value === "EXISTING" && input.value === nameToDelete) {
        select.value = "in";
        document.getElementById(`${prefix}-existing-container`).classList.add("hidden");
        input.value = "";
        select.dispatchEvent(new Event('change'));
      }
    });

    alert(`Event "${nameToDelete}" has been deleted.`);
  }

  const loadEventBtn = document.getElementById("load-event-btn");
  if (loadEventBtn) {
    loadEventBtn.addEventListener("click", () => {
      const select = document.getElementById("saved-events-select");
      const eventName = select.value;
      if (!eventName) return alert("Select an event to edit.");

      const library = JSON.parse(localStorage.getItem("iseql_library") || "[]");
      const evt = library.find(e => e.name === eventName);

      if (!evt) return;
      if (!evt.uiState) {
        return alert("This event was saved with an older version and cannot be edited visually.");
      }

      loadUIFromState(evt.name, evt.uiState);
      alert(`Event "${evt.name}" loaded for editing.`);
    });
  }

  // Restore the UI using a previously saved state
  function loadUIFromState(name, state) {
    document.getElementById("event-name").value = name;

    setupOperand("op1", state.op1);
    setupOperand("op2", state.op2);

    refreshAllVariableDropdowns();

    const radios = document.getElementsByName("temp-relation");
    radios.forEach(r => {
      if (r.value === state.relation.type) r.checked = true;
    });
    const relationsRadio = document.querySelector('input[name="temp-relation"]:checked');
    if (relationsRadio) relationsRadio.dispatchEvent(new Event('change'));

    if (state.relation.type === "sequential") {
      document.getElementById("seq-order").value = state.relation.seqOrder;
      document.getElementById("seq-max-gap").value = state.relation.seqGap;
    } else {
      document.getElementById("overlap-type").value = state.relation.overlapType;
      document.getElementById("overlap-type").dispatchEvent(new Event('change'));
      document.getElementById("overlap-delta").value = state.relation.delta;
      document.getElementById("overlap-epsilon").value = state.relation.epsilon;
    }

    const cList = document.getElementById("constraints-list");
    cList.innerHTML = "";

    state.constraints.forEach(c => {
      document.getElementById("add-constraint-btn").click();
      const lastRow = cList.lastElementChild;

      if (lastRow) {
        const sel1 = lastRow.querySelector(".c-op1");
        const sel2 = lastRow.querySelector(".c-op2");

        sel1.innerHTML = generateVariableOptionsHTML();
        sel2.innerHTML = generateVariableOptionsHTML();

        sel1.value = c.op1;
        lastRow.querySelector(".c-operator").value = c.operator;
        sel2.value = c.op2;
        lastRow.querySelector(".c-modifier").value = c.mod;
      }
    });

    document.getElementById("exclusion-mode").checked = state.exclusion;

    const pList = document.getElementById("projection-list");
    pList.innerHTML = "";
    state.projection.fields.forEach(p => {
      addProjectionRow(p.source, p.alias);

      const lastRow = pList.lastElementChild;
      const sourceSelect = lastRow.querySelector(".proj-source");

      sourceSelect.innerHTML = generateVariableOptionsHTML();

      sourceSelect.value = p.source;
    });

    const sfSel = document.getElementById("proj-start-source");
    const efSel = document.getElementById("proj-end-source");

    sfSel.value = state.projection.start;
    efSel.value = state.projection.end;

    document.getElementById("generate-btn").click();
  }

  // Restore operand configuration (predicate and arguments)
  function setupOperand(prefix, opState) {
    const select = document.getElementById(`${prefix}-predicate`);

    let foundOption = false;

    if (opState.pred === "EXISTING") {
      for (let i = 0; i < select.options.length; i++) {
        const opt = select.options[i];
        if (opt.value === "EXISTING" && opt.dataset.realName === opState.existName) {
          select.selectedIndex = i;
          foundOption = true;
          break;
        }
      }
    }

    if (!foundOption) {
      select.value = opState.pred;
    }

    select.dispatchEvent(new Event('change'));

    if (opState.pred === "EXISTING") {
      document.getElementById(`${prefix}-existing-name`).value = opState.existName;
    }

    setTimeout(() => {
      const container = document.getElementById(`${prefix}-args-container`);
      if (opState.args && container) {
        Object.keys(opState.args).forEach(key => {
          const input = container.querySelector(`input[data-field-id="${key}"]`);
          if (input) input.value = opState.args[key];
        });
      }
    }, 50);
  }

  // Copy generated code to clipboard
  const copyBtn = document.getElementById("copy-btn");
  if (copyBtn) {
    copyBtn.addEventListener("click", () => {
      const outputArea = document.getElementById("output-area");

      if (!outputArea.value.trim()) {
        alert("Generate the code first!");
        return;
      }

      navigator.clipboard.writeText(outputArea.value)
        .then(() => {
          const originalText = copyBtn.textContent;
          copyBtn.textContent = "Copied!";
          copyBtn.style.backgroundColor = "#95a5a6";

          setTimeout(() => {
            copyBtn.textContent = originalText;
            copyBtn.style.backgroundColor = "#7f8c8d";
          }, 2000);
        })
        .catch(err => {
          console.error("Error copying text: ", err);
          alert("Failed to copy text.");
        });
    });
  }

  // Export selected event as JSON
  const exportBtn = document.getElementById("export-json-btn");
  if (exportBtn) {
    exportBtn.addEventListener("click", () => {
      const select = document.getElementById("saved-events-select");
      const selectedName = select.value;

      if (!selectedName) {
        alert("Please select an event from the list above to export.");
        return;
      }

      const library = JSON.parse(localStorage.getItem("iseql_library") || "[]");
      const evt = library.find(e => e.name === selectedName);

      if (!evt) return alert("Event not found in memory.");

      const blob = new Blob([JSON.stringify(evt, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = `${selectedName}.json`;

      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });
  }

  // Import event definition from JSON file
  const importBtn = document.getElementById("import-json-btn");
  const fileInput = document.getElementById("import-json-input");

  if (importBtn && fileInput) {
    importBtn.addEventListener("click", () => fileInput.click());

    fileInput.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const importedEvt = JSON.parse(event.target.result);

          if (!importedEvt.name || !importedEvt.logicDefinition) {
            throw new Error("Invalid JSON: Missing name or logic definition.");
          }

          const eventToSave = Array.isArray(importedEvt) ? importedEvt[0] : importedEvt;

          let currentLibrary = JSON.parse(localStorage.getItem("iseql_library") || "[]");

          currentLibrary = currentLibrary.filter(ev => ev.name !== eventToSave.name);
          currentLibrary.push(eventToSave);

          localStorage.setItem("iseql_library", JSON.stringify(currentLibrary));

          renderSavedEventsManager();
          updateDropdowns();

          const select = document.getElementById("saved-events-select");
          select.value = eventToSave.name;

          alert(`Success! Loaded event "${eventToSave.name}".`);

        } catch (err) {
          console.error(err);
          alert("Failed to load JSON: " + err.message);
        }
        fileInput.value = "";
      };
      reader.readAsText(file);
    });
  }
});