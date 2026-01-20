document.addEventListener("DOMContentLoaded", () => {
  // ==========================================
  // 1. INITIALIZATION & MOCK DATABASE
  // ==========================================

  updateDropdowns();

  // Initialize UI on load
  ["op1", "op2"].forEach(prefix => {
      updateSchemaInfoBox(prefix);
      renderArgumentInputs(prefix);
  });

  const saveBtn = document.getElementById("save-event-btn");
  if (saveBtn) {
    saveBtn.addEventListener("click", () => {
      const eventName = document.getElementById("event-name").value;
      if (!eventName) return alert("Name required.");

      // 1. Capture the Dynamic Schema defined in Step 4
      let outputSchema = [];
      document.querySelectorAll(".proj-row").forEach((row) => {
        const source = row.querySelector(".proj-source").value; 
        const userAlias = row.querySelector(".proj-alias").value;
        
        // FIX: If alias is empty, use the full source with an underscore (e.g. BDPE_arg1)
        // Note: 'source' might now look like "BDPE.arg1" instead of "M1.arg1"
        const cleanSource = source.replace(/\./g, '_'); 
        const uniqueId = userAlias ? userAlias : cleanSource;
        
        outputSchema.push({ id: uniqueId, label: userAlias || cleanSource });
      });

      // 2. Capture the Logic for "Verbose" expansion later
      // We grab the raw algebra from the output textarea (stripping the SQL wrapper)
      const fullText = document.getElementById("output-area").value;
      // Extract just the part between "SELECT * FROM" and "; END;"
      // This is a simple heuristic for this tool
      let logicDef = "";
      if (fullText.includes("SELECT * FROM")) {
          const start = fullText.indexOf("SELECT * FROM") + 13;
          const end = fullText.lastIndexOf(";");
          logicDef = fullText.substring(start, end).trim();
      }

      // 3. Save
      const eventData = {
        name: eventName,
        outputSchema: outputSchema,
        logicDefinition: logicDef, // <--- SAVING THE ALGEBRA
        date: new Date().toISOString(),
      };
      
      let library = JSON.parse(localStorage.getItem("iseql_library") || "[]");
      
      // Remove old version if exists (to allow overwriting/redefining)
      library = library.filter(e => e.name !== eventName);

      library.push(eventData);
      localStorage.setItem("iseql_library", JSON.stringify(library));

      alert(`Saved "${eventName}"!`);
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
        const inputContainer = document.getElementById(`${prefix}-existing-container`);
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
        renderArgumentInputs(prefix);
        refreshAllVariableDropdowns(); // <--- This will now use the NEW ALIASES
      });
    }
  });


  // ==========================================
  // 2. HELPER: DYNAMIC ALIASING
  // ==========================================

  // Returns "M1" or "M2" for basic predicates, OR the Event Name for saved events
  function getOperandAlias(prefix) {
      const predSelect = document.getElementById(`${prefix}-predicate`);
      if (!predSelect) return (prefix === 'op1' ? "M1" : "M2");

      if (predSelect.value === "EXISTING") {
          const selectedOpt = predSelect.options[predSelect.selectedIndex];
          // Return the real name (e.g. "BDPE")
          // Fallback to M1/M2 if something is wrong
          return selectedOpt.dataset.realName || (prefix === 'op1' ? "M1" : "M2");
      }
      // For basic predicates (in, hasPkg), stick to M1/M2 convention
      return (prefix === 'op1' ? "M1" : "M2");
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
    
    // Helper to format options using the Dynamic Alias
    const formatOption = (prefixStr, alias, field) => {
        // value="BDPE.arg1", text="BDPE.arg1 (Giver)"
        return `<option value="${alias}.${field.id}">${alias}.${field.label}</option>`;
    };

    // OP 1
    const alias1 = getOperandAlias("op1");
    const m1Schema = getSchemaForOperand("op1");
    html += `<optgroup label="${alias1} Variables">`;
    m1Schema.forEach((field) => {
      html += formatOption("op1", alias1, field);
    });
    html += `<option value="${alias1}.sf">${alias1} Start Frame</option>`;
    html += `<option value="${alias1}.ef">${alias1} End Frame</option>`;
    html += `</optgroup>`;

    // OP 2
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

  // Refreshes the dropdowns in Step 3 & 4
  function refreshAllVariableDropdowns() {
    const newOptions = generateVariableOptionsHTML();
    document.querySelectorAll(".c-op1, .c-op2").forEach((select) => {
      // We attempt to keep the selected value if it still exists, 
      // but usually the alias change invalidates it.
      select.innerHTML = newOptions;
    });
    document.querySelectorAll(".proj-source").forEach((select) => {
      select.innerHTML = newOptions;
    });
  }

  function renderArgumentInputs(prefix) {
      const container = document.getElementById(`${prefix}-args-container`);
      if(!container) return;
      
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


  // ==========================================
  // 3. UI LOGIC (Steps 2 & 3 - Standard)
  // ==========================================

  const relationRadios = document.getElementsByName("temp-relation");
  const seqOptions = document.getElementById("sequential-options");
  const overlapOptions = document.getElementById("overlapping-options");
  const overlapTypeSelect = document.getElementById("overlap-type");
  const labelDelta = document.getElementById("label-delta");
  const labelEpsilon = document.getElementById("label-epsilon");
  const containerEpsilon = document.getElementById("container-epsilon");

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

  function updateOverlapInputs() {
    const type = overlapTypeSelect.value;
    containerEpsilon.style.display = "block";
    document.getElementById("overlap-delta").parentElement.style.display = "block";
    if (type === "DJ") {
      labelDelta.textContent = "Max Start Delay [δ]";
      labelEpsilon.textContent = "Max End Delay [ε]";
    } else if (type === "SP") {
      labelDelta.textContent = "Max Start Delay [δ]";
      containerEpsilon.style.display = "none";
    } else if (type === "EF") {
      document.getElementById("overlap-delta").parentElement.style.display = "none";
      labelEpsilon.textContent = "Max End Delay [ε]";
    } else {
      labelDelta.textContent = "Start Point Distance [δ]";
      labelEpsilon.textContent = "End Point Distance [ε]";
    }
  }

  relationRadios.forEach((r) => r.addEventListener("change", updateRelationUI));
  if (overlapTypeSelect) overlapTypeSelect.addEventListener("change", updateOverlapInputs);
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
      row.querySelector(".remove-btn").addEventListener("click", () => row.remove());
      constraintsList.appendChild(row);
    });
    // Add default row
    // Use a small timeout to let dropdowns populate first
    setTimeout(() => {
        if(constraintsList.children.length === 0) addConstraintBtn.click();
    }, 200);
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
    row.querySelector(".remove-btn").addEventListener("click", () => row.remove());
    projList.appendChild(row);
  }

  setTimeout(() => {
    if (projList && projList.children.length === 0) {
        // We try to default to sensible defaults, but aliases are dynamic now
        const alias1 = getOperandAlias('op1');
        const alias2 = getOperandAlias('op2');
        addProjectionRow(`${alias1}.arg1`, "arg1");
        addProjectionRow(`${alias2}.arg1`, "arg2");
    }
  }, 300);


  // ==========================================
  // 4. GENERATION LOGIC (UPDATED WITH RECURSION CHECK)
  // ==========================================

  document.getElementById("generate-btn").addEventListener("click", generateISEQL);

  function generateISEQL() {
    const currentEventName = document.getElementById("event-name").value;

    // Get Aliases
    const alias1 = getOperandAlias("op1");
    const alias2 = getOperandAlias("op2");

    // Build Operands with Recursive Check
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
    let argCounter = 1;

    document.querySelectorAll(".proj-row").forEach((row) => {
      const source = row.querySelector(".proj-source").value;
      const alias = row.querySelector(".proj-alias").value;
      
      let finalAlias = "";
      if (alias && alias.trim() !== "") {
        finalAlias = alias;
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

  // --- BUILD OPERAND STRING (HANDLES RECURSION) ---
  
  function buildOperandString(prefix, alias, definitionName) {
    const pred = document.getElementById(`${prefix}-predicate`).value;
    let constraints = [];
    
    // Gather filter constraints
    const container = document.getElementById(`${prefix}-args-container`);
    if (container) {
        container.querySelectorAll('.dynamic-arg-input').forEach(input => {
            if(input.value && input.value.trim() !== "") {
                const fieldId = input.dataset.fieldId;
                constraints.push(`${fieldId}="${input.value}"`);
            }
        });
    }

    // CASE 1: EXISTING SAVED EVENT
    if (pred === "EXISTING") {
      const existName = document.getElementById(`${prefix}-existing-name`).value || "EventX";
      
      // *** THE RECURSION CHECK ***
      // If the event we are using (existName) IS the event we are currently defining (definitionName)
      // Then we must Expand it Verbose (use the stored logic)
      if (definitionName && existName === definitionName) {
          const library = JSON.parse(localStorage.getItem("iseql_library") || "[]");
          const savedEvent = library.find(e => e.name === existName);
          
          if (savedEvent && savedEvent.logicDefinition) {
              // Return the raw Algebra
              // If there are constraints, wrap the big block in Selection
              if (constraints.length > 0) {
                  return `σ_{ ${constraints.join(" ∧ ")} } ( \n ${savedEvent.logicDefinition} \n )`;
              }
              return `( \n ${savedEvent.logicDefinition} \n )`;
          }
      }

      // Normal Case: Refer to it by Name (aliased)
      if (constraints.length > 0) {
          return `σ_{ ${constraints.join(" ∧ ")} }(${existName}(${alias}))`;
      } else {
          return `${existName}(${alias})`;
      }
    }
    
    // CASE 2: RAW PREDICATE (in, hasPkg)
    constraints.unshift(`pred="${pred}"`);
    return `σ_{ ${constraints.join(" ∧ ")} }(${alias})`;
  }

});