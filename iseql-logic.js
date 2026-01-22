document.addEventListener("DOMContentLoaded", () => {
  // ==========================================
  // 1. INITIALIZATION & MOCK DATABASE
  // ==========================================

  updateDropdowns();
  renderLibraryList();

  // Initialize UI on load
  ["op1", "op2"].forEach(prefix => {
    updateSchemaInfoBox(prefix);
    renderArgumentInputs(prefix);
  });

  // 1. REEMPLAZA TU saveBtn ACTUAL CON ESTE BLOQUE MEJORADO:
  
  const saveBtn = document.getElementById("save-event-btn");
  if (saveBtn) {
    saveBtn.addEventListener("click", () => {
      const eventName = document.getElementById("event-name").value;
      if (!eventName) return alert("Name required.");

      // A) CAPTURAR EL ESQUEMA DE SALIDA (Para usarlo en otros eventos)
      let outputSchema = [];
      document.querySelectorAll(".proj-row").forEach((row, index) => {
        const description = row.querySelector(".proj-alias").value;
        const standardAlias = `arg${index + 1}`; 
        outputSchema.push({ 
            id: standardAlias,      
            label: description || standardAlias 
        });
      });

      // B) CAPTURAR EL CÓDIGO GENERADO
      const fullText = document.getElementById("output-area").value;
      let logicDef = "";
      if (fullText.includes("SELECT * FROM")) {
        const start = fullText.indexOf("SELECT * FROM") + 13;
        const end = fullText.lastIndexOf(";");
        logicDef = fullText.substring(start, end).trim();
      }

      // C) CAPTURAR EL ESTADO DE LA INTERFAZ (UI STATE) - ¡ESTO ES LO NUEVO!
      // Guardamos cada valor de cada input para poder restaurarlo al editar
      const uiState = {
          op1: {
              pred: document.getElementById("op1-predicate").value,
              existingName: document.getElementById("op1-existing-name").value,
              args: getArgsValues("op1") // Función auxiliar definida abajo
          },
          op2: {
              pred: document.getElementById("op2-predicate").value,
              existingName: document.getElementById("op2-existing-name").value,
              args: getArgsValues("op2")
          },
          relation: {
              type: document.querySelector('input[name="temp-relation"]:checked').value,
              seqOrder: document.getElementById("seq-order").value,
              seqGap: document.getElementById("seq-max-gap").value,
              overlapType: document.getElementById("overlap-type").value,
              overlapDelta: document.getElementById("overlap-delta").value,
              overlapEpsilon: document.getElementById("overlap-epsilon").value
          },
          constraints: getConstraintsState(), // Función auxiliar definida abajo
          projections: getProjectionsState(), // Función auxiliar definida abajo
          exclusion: document.getElementById("exclusion-mode").checked,
          projStart: document.getElementById("proj-start-source").value,
          projEnd: document.getElementById("proj-end-source").value
      };

      // D) GUARDAR EN LOCALSTORAGE
      const eventData = {
        name: eventName,
        outputSchema: outputSchema,
        logicDefinition: logicDef,
        uiState: uiState, // Guardamos la configuración visual
        date: new Date().toISOString(),
      };

      let library = JSON.parse(localStorage.getItem("iseql_library") || "[]");
      // Si ya existe, lo sobrescribimos manteniendo su posición si es posible, o filtrando
      const existingIdx = library.findIndex(e => e.name === eventName);
      if (existingIdx >= 0) {
          library[existingIdx] = eventData;
      } else {
          library.push(eventData);
      }
      
      localStorage.setItem("iseql_library", JSON.stringify(library));

      alert(`Saved "${eventName}" successfully!`);
      updateDropdowns();
      renderLibraryList();
    });
  }

  // FUNCIONES AUXILIARES PARA CAPTURAR ESTADO (Pégalas justo después del saveBtn)
  function getArgsValues(prefix) {
      const args = {};
      const container = document.getElementById(`${prefix}-args-container`);
      if (container) {
          container.querySelectorAll('input').forEach(input => {
              if (input.value) args[input.dataset.fieldId] = input.value;
          });
      }
      return args;
  }

  function getConstraintsState() {
      const list = [];
      document.querySelectorAll(".constraint-row").forEach(row => {
          list.push({
              op1: row.querySelector(".c-op1").value,
              operator: row.querySelector(".c-operator").value,
              op2: row.querySelector(".c-op2").value,
              modifier: row.querySelector(".c-modifier").value
          });
      });
      return list;
  }

  function getProjectionsState() {
      const list = [];
      document.querySelectorAll(".proj-row").forEach(row => {
          list.push({
              source: row.querySelector(".proj-source").value,
              alias: row.querySelector(".proj-alias").value
          });
      });
      return list;
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


  // ==========================================
  // 2. HELPER: DYNAMIC ALIASING
  // ==========================================

  function getOperandAlias(prefix) {
    const predSelect = document.getElementById(`${prefix}-predicate`);
    if (!predSelect) return (prefix === 'op1' ? "M1" : "M2");

    if (predSelect.value === "EXISTING") {
      const selectedOpt = predSelect.options[predSelect.selectedIndex];
      return selectedOpt.dataset.realName || (prefix === 'op1' ? "M1" : "M2");
    }
    return (prefix === 'op1' ? "M1" : "M2");
  }

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

  function generateVariableOptionsHTML() {
    let html = "";

    // FIX: If the field ID contains a dot (e.g. "M1.arg1"), 
    // it implies it's a bubbled-up name. Show it RAW, without the Alias prefix.
    const formatOption = (prefixStr, alias, field) => {
      if (field.id.includes('.')) {
        // Example: ID="M1.arg1". Value should be "M1.arg1" (quoted implicitly by usage)
        // We use quotes in the value to be safe for the constraints logic? 
        // Actually, let's keep it clean string: "M1.arg1"
        return `<option value='"${field.id}"'>${field.label}</option>`;
      }
      // Standard Case: "DPE2.arg1"
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

  function refreshAllVariableDropdowns() {
    const newOptions = generateVariableOptionsHTML();
    document.querySelectorAll(".c-op1, .c-op2").forEach((select) => {
      select.innerHTML = newOptions;
    });
    document.querySelectorAll(".proj-source").forEach((select) => {
      select.innerHTML = newOptions;
    });
  }

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

  // REPLACE the existing updateOverlapInputs function in iseql-logic.js

  function updateOverlapInputs() {
    const type = overlapTypeSelect.value;
    const containerEpsilon = document.getElementById("container-epsilon");
    const labelDelta = document.getElementById("label-delta");
    const labelEpsilon = document.getElementById("label-epsilon");

    // Default visibility
    containerEpsilon.style.display = "block";
    document.getElementById("overlap-delta").parentElement.style.display = "block";

    // Dynamic Labels based on the PDF definitions
    switch (type) {
      case "DJ": // M1 inside M2
        labelDelta.textContent = "Max Start Diff (M1 starts after M2) [δ]";
        labelEpsilon.textContent = "Max End Diff (M1 ends before M2) [ε]";
        break;
      case "RDJ": // M2 inside M1 (NEW)
        labelDelta.textContent = "Max Start Diff (M2 starts after M1) [δ]";
        labelEpsilon.textContent = "Max End Diff (M2 ends before M1) [ε]";
        break;
      case "LOJ": // M1 starts before M2
        labelDelta.textContent = "Max Start Delay (M2 starts after M1) [δ]";
        labelEpsilon.textContent = "Max End Delay (M2 ends after M1) [ε]";
        break;
      case "ROJ": // M2 starts before M1 (NEW)
        labelDelta.textContent = "Max Start Delay (M1 starts after M2) [δ]";
        labelEpsilon.textContent = "Max End Delay (M1 ends after M2) [ε]";
        break;
      case "SP": // Start Preceding
        labelDelta.textContent = "Max Start Distance [δ]";
        containerEpsilon.style.display = "none"; // SP doesn't use Epsilon
        break;
      case "EF": // End Following
        document.getElementById("overlap-delta").parentElement.style.display = "none"; // EF doesn't use Delta
        labelEpsilon.textContent = "Max End Distance [ε]";
        break;
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
    setTimeout(() => {
      if (constraintsList.children.length === 0) addConstraintBtn.click();
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
      const alias1 = getOperandAlias('op1');
      const alias2 = getOperandAlias('op2');
      addProjectionRow(`${alias1}.arg1`, "arg1");
      addProjectionRow(`${alias2}.arg1`, "arg2");
    }
  }, 300);


  // ==========================================
  // 4. GENERATION LOGIC
  // ==========================================

  document.getElementById("generate-btn").addEventListener("click", generateISEQL);

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
      // --- OVERLAPPING / INTERVAL RELATIONS ---
      const type = overlapTypeSelect.value;
      const delta = document.getElementById("overlap-delta").value;
      const epsilon = document.getElementById("overlap-epsilon").value;
      let params = [];

      // "d" is the algebra symbol for Infinity/Max in the paper
      const dVal = delta && delta.trim() !== "" ? delta : "d";
      const eVal = epsilon && epsilon.trim() !== "" ? epsilon : "d";

      // Logic Mapping based on PDF definitions:
      // SP uses only Delta
      // EF uses only Epsilon
      // DJ, RDJ, LOJ, ROJ use BOTH Delta and Epsilon

      if (type === "SP") {
        params.push(`δ=${dVal}`);
      }
      else if (type === "EF") {
        params.push(`ε=${eVal}`);
      }
      else {
        // DJ, RDJ, LOJ, ROJ all take two parameters {δ, ε}
        params.push(`δ=${dVal}`);
        params.push(`ε=${eVal}`);
      }

      // The operator string becomes e.g., RDJ_{δ=30, ε=30}
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
      // If user provided alias, use it. Otherwise use source (quoted) as alias.
      if (alias && alias.trim() !== "") {
        finalAlias = alias;
      } else {
        // e.g. source="M1.arg1" -> alias="M1.arg1"
        // We use quotes to make it a valid column identifier
        finalAlias = `"${source.replace(/"/g, '')}"`;
      }

      // If source already has quotes (from Dropdown), keep them.
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

  const deleteBtn = document.getElementById("delete-selected-btn");
  if (deleteBtn) {
    deleteBtn.addEventListener("click", function () {
      const select = document.getElementById("saved-events-dropdown");
      const selectedIndex = select.value;

      if (selectedIndex === "" || selectedIndex === null) {
        alert("Please select an event to delete.");
        return;
      }

      deleteEvent(parseInt(selectedIndex));
    });
  }

  // Nueva función de renderizado (Modo Dropdown)
  function renderLibraryList() {
    const dropdown = document.getElementById("saved-events-dropdown");
    if (!dropdown) return;

    dropdown.innerHTML = "";
    const library = JSON.parse(localStorage.getItem("iseql_library") || "[]");

    if (library.length === 0) {
      const option = document.createElement("option");
      option.text = "(No saved events)";
      option.value = "";
      dropdown.appendChild(option);
      dropdown.disabled = true;
      return;
    }

    dropdown.disabled = false;

    // Crear opción por defecto
    const defaultOption = document.createElement("option");
    defaultOption.text = "Select an event to manage";
    defaultOption.value = "";
    dropdown.appendChild(defaultOption);

    library.forEach((evt, index) => {
      const option = document.createElement("option");
      option.value = index; // Usamos el índice como valor para saber cuál borrar
      option.text = `${evt.name} (${evt.outputSchema.length} fields)`;
      dropdown.appendChild(option);
    });
  }

  function deleteEvent(index) {
    let library = JSON.parse(localStorage.getItem("iseql_library") || "[]");
    const eventName = library[index].name;

    if (confirm(`Are you sure you want to permanently delete "${eventName}"?`)) {
      library.splice(index, 1);
      localStorage.setItem("iseql_library", JSON.stringify(library));

      renderLibraryList(); // Actualizar el dropdown de arriba
      updateDropdowns();   // Actualizar los selectores del Paso 1

      // Limpiar el input de nombre si coincidía con el borrado
      const nameInput = document.getElementById("event-name");
      if (nameInput.value === eventName) {
        nameInput.value = "";
      }
    }
  }

  // --- INICIO FUNCIONALIDAD QoL (COPIAR Y BACKUP) ---

  // 1. Funcionalidad Copiar al Portapapeles
  const copyBtn = document.getElementById("copy-code-btn");
  if (copyBtn) {
    copyBtn.addEventListener("click", () => {
      const textArea = document.getElementById("output-area");
      textArea.select();
      document.execCommand("copy");
      alert("Code copied to clipboard.");
    });
  }

  // --- BLOQUE FINAL: EDITAR Y BACKUP INTELIGENTE ---

  // 1. LOGICA DE EDITAR (Carga el evento en la pantalla para modificarlo)
  // 2. REEMPLAZA TU LOGICA DE EDITAR CON ESTA VERSIÓN DE AUTOCOMPLETADO:

  const editBtn = document.getElementById("edit-selected-btn");
  if (editBtn) {
    editBtn.addEventListener("click", function() {
        const select = document.getElementById("saved-events-dropdown");
        const selectedIndex = select.value;

        if (selectedIndex === "" || selectedIndex === null) {
            alert("Please select an event to edit.");
            return;
        }

        const library = JSON.parse(localStorage.getItem("iseql_library") || "[]");
        const evt = library[selectedIndex];
        
        // Cargar Nombre
        document.getElementById("event-name").value = evt.name;

        // VERIFICAR SI TIENE ESTADO UI GUARDADO (Eventos antiguos no tendrán esto)
        if (!evt.uiState) {
            alert("This is an old event without UI data saved. Only the code is available.");
            document.getElementById("output-area").value = evt.logicDefinition;
            return;
        }

        const ui = evt.uiState;

        // --- RESTAURAR PASO 1 (Operandos) ---
        restoreOperand("op1", ui.op1);
        restoreOperand("op2", ui.op2);

        // --- RESTAURAR PASO 2 (Relaciones) ---
        const radios = document.getElementsByName("temp-relation");
        radios.forEach(r => {
            if (r.value === ui.relation.type) r.checked = true;
        });
        // Forzar actualización visual
        const event = new Event("change");
        radios[0].dispatchEvent(event); 

        if (ui.relation.type === "sequential") {
            document.getElementById("seq-order").value = ui.relation.seqOrder;
            document.getElementById("seq-max-gap").value = ui.relation.seqGap;
        } else {
            document.getElementById("overlap-type").value = ui.relation.overlapType;
            // Disparar cambio para actualizar labels
            document.getElementById("overlap-type").dispatchEvent(new Event("change"));
            document.getElementById("overlap-delta").value = ui.relation.overlapDelta;
            document.getElementById("overlap-epsilon").value = ui.relation.overlapEpsilon;
        }

        // --- RESTAURAR PASO 3 (Constraints) ---
        document.getElementById("constraints-list").innerHTML = ""; // Limpiar
        if (ui.constraints) {
            ui.constraints.forEach(c => {
                addConstraintRow(c); // Función auxiliar abajo
            });
        }
        document.getElementById("exclusion-mode").checked = ui.exclusion;

        // --- RESTAURAR PASO 4 (Projections) ---
        document.getElementById("projection-list").innerHTML = ""; // Limpiar
        // Restaurar selectores de Start/End
        if (ui.projStart) document.getElementById("proj-start-source").value = ui.projStart;
        if (ui.projEnd) document.getElementById("proj-end-source").value = ui.projEnd;

        if (ui.projections) {
            ui.projections.forEach(p => {
                addProjectionRow(p.source, p.alias); // Usamos tu función existente
            });
        }

        alert(`Event "${evt.name}" fully loaded into the editor!`);
    });
  }

  // --- FUNCIONES AUXILIARES PARA EDITAR (Pégalas al final) ---

  function restoreOperand(prefix, data) {
      const select = document.getElementById(`${prefix}-predicate`);
      select.value = data.pred;
      // Disparar el evento change para que aparezcan los inputs de argumentos
      select.dispatchEvent(new Event("change"));

      if (data.pred === "EXISTING") {
          document.getElementById(`${prefix}-existing-name`).value = data.existingName;
          // Disparar cambio si fuera necesario para cargar esquema del evento existente
          document.getElementById(`${prefix}-existing-name`).dispatchEvent(new Event("input")); 
      }

      // Rellenar argumentos (necesitamos un pequeño timeout para que el DOM se cree tras el 'change')
      setTimeout(() => {
          const container = document.getElementById(`${prefix}-args-container`);
          if (container && data.args) {
              Object.keys(data.args).forEach(fieldId => {
                  const input = container.querySelector(`input[data-field-id="${fieldId}"]`);
                  if (input) input.value = data.args[fieldId];
              });
          }
      }, 50);
  }

  function addConstraintRow(data) {
      // Simulamos el clic en el botón de añadir
      const addBtn = document.getElementById("add-constraint-btn");
      // Creamos la fila manualmente reutilizando la lógica o clickeando
      // Para hacerlo limpio, copiamos la lógica de creación aquí brevemente:
      
      const constraintsList = document.getElementById("constraints-list");
      const row = document.createElement("div");
      row.className = "constraint-row input-group";
      row.style.display = "flex";
      row.style.gap = "5px";
      row.style.marginBottom = "10px";
      const variableOptionsHTML = generateVariableOptionsHTML(); // Usa tu función existente

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
      
      // Asignar valores
      row.querySelector(".c-op1").value = data.op1;
      row.querySelector(".c-operator").value = data.operator;
      row.querySelector(".c-op2").value = data.op2;
      row.querySelector(".c-modifier").value = data.modifier;

      row.querySelector(".remove-btn").addEventListener("click", () => row.remove());
      constraintsList.appendChild(row);
  }

  // Función auxiliar para añadir filas en modo edición
  function addProjectionRowForEdit(id, label) {
    const row = document.createElement("div");
    row.className = "proj-row input-group";
    row.style.display = "flex";
    row.style.gap = "10px";
    row.style.marginBottom = "10px";
    
    // En modo edición no sabemos la fuente exacta (M1.arg1?), así que mostramos un selector genérico
    const optionsHTML = generateVariableOptionsHTML();

    row.innerHTML = `
        <div style="display:flex; align-items:center; background:#eee; padding:0 10px; border:1px solid #ccc; border-radius:4px; font-weight:bold; color:#555;">
            ${id}
        </div>
        <select class="proj-source" style="flex:2">
             <option value="" disabled selected>(Select source if changing)</option>
             ${optionsHTML}
        </select>
        <input type="text" class="proj-alias" value="${label}" style="flex:1">
        <button class="btn remove-btn" style="background:#e74c3c; width:auto; padding: 0 10px;">X</button>
    `;
    row.querySelector(".remove-btn").addEventListener("click", () => row.remove());
    document.getElementById("projection-list").appendChild(row);
  }

  // 2. BACKUP INTELIGENTE (Uno o Todos)
  const dlBtn = document.getElementById("download-backup-btn");
  if (dlBtn) {
    dlBtn.addEventListener("click", () => {
        const select = document.getElementById("saved-events-dropdown");
        const selectedIndex = select.value;
        const library = JSON.parse(localStorage.getItem("iseql_library") || "[]");
        
        let dataToSave;
        let fileName;

        if (selectedIndex !== "" && selectedIndex !== null) {
            // Caso A: Guardar SOLO el seleccionado
            const evt = library[selectedIndex];
            dataToSave = [evt]; // Lo guardamos como una lista de 1 elemento para poder importarlo igual
            fileName = `iseql_event_${evt.name}.json`;
        } else {
            // Caso B: Guardar TODO
            dataToSave = library;
            fileName = "iseql_library_full_backup.json";
        }

        const blob = new Blob([JSON.stringify(dataToSave, null, 2)], {type: "application/json"});
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = fileName;
        a.click();
    });
  }

  // 3. Funcionalidad Cargar Backup (Upload)
  const upBtn = document.getElementById("upload-backup-btn");
  const upInput = document.getElementById("upload-backup-input");

  if (upBtn && upInput) {
    upBtn.addEventListener("click", () => upInput.click());
    upInput.addEventListener("change", (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                // Validar que sea JSON
                JSON.parse(ev.target.result); 
                // Guardar en memoria local
                localStorage.setItem("iseql_library", ev.target.result);
                alert("Library loaded successfully.");
                // Refrescar la interfaz
                updateDropdowns();
                renderLibraryList();
            } catch (err) {
                alert("Invalid JSON file.");
            }
        };
        reader.readAsText(file);
    });
  }
});