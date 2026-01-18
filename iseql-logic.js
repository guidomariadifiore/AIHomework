document.addEventListener('DOMContentLoaded', () => {

    // --- INITIALIZATION ---
    // Default "Hardcoded" Schema for basic predicates (in, hasPkg)
    const BASE_PREDICATES = {
        'in': { args: ['Arg1 (Item)'], defaultSf: true, defaultEf: true },
        'hasPkg': { args: ['Arg1 (Holder)', 'Arg2 (Package)'], defaultSf: true, defaultEf: true },
        'insideCar': { args: ['Arg1 (Person)', 'Arg2 (Car)'], defaultSf: true, defaultEf: true }
    };

    updateDropdowns(); // Load saved events

    // --- PROJECTION UI LOGIC (Step 4) ---
    const projList = document.getElementById('projection-list');
    
    // Function to add a projection row
    document.getElementById('add-proj-col-btn').addEventListener('click', () => {
        addProjectionRow(); 
    });

    function addProjectionRow(defaultValue = "") {
        const row = document.createElement('div');
        row.className = 'proj-row input-group';
        row.style.display = 'flex'; 
        row.style.gap = '10px'; 
        row.style.marginBottom = '5px';
        
        row.innerHTML = `
            <input type="text" class="proj-label" placeholder="Column Name (e.g. Victim)" style="flex:1">
            <span style="padding-top:8px;">&larr; Map From &larr;</span>
            <select class="proj-source" style="flex:1">
                ${getAvailableVariablesOptions()}
            </select>
            <button class="btn remove-btn" style="background:#e74c3c; width:auto;">X</button>
        `;
        row.querySelector('.remove-btn').addEventListener('click', () => row.remove());
        if(defaultValue) row.querySelector('.proj-source').value = defaultValue;
        projList.appendChild(row);
    }

    // Add default rows on load (Arg1, Arg2)
    addProjectionRow('M1.arg1');
    addProjectionRow('M2.arg1');


    // --- OPERAND SELECTION LOGIC (Step 1) ---
    const opSelects = document.querySelectorAll('.operand-select');
    
    opSelects.forEach(select => {
        select.addEventListener('change', function() {
            const prefix = this.id.split('-')[0]; // op1 or op2
            const schemaBox = document.getElementById(`${prefix}-schema-display`);
            const schemaList = schemaBox.querySelector('ul');
            
            // Clear previous info
            schemaList.innerHTML = '';
            
            let args = [];
            
            // Is it a saved event?
            const selectedOpt = this.options[this.selectedIndex];
            if (selectedOpt.dataset.schema) {
                // Saved Event: Parse stored schema
                const schema = JSON.parse(selectedOpt.dataset.schema);
                args = schema.args; // e.g. ["Giver", "Receiver", "Package"]
                schemaBox.style.display = 'block';
            } else if (BASE_PREDICATES[this.value]) {
                // Base Predicate
                args = BASE_PREDICATES[this.value].args;
                schemaBox.style.display = 'none'; // Optional: hide for basics or show
            }

            // Populate Schema Info Box
            args.forEach((arg, index) => {
                const li = document.createElement('li');
                li.textContent = `Arg${index + 1}: ${arg}`;
                schemaList.appendChild(li);
            });

            // Update all "Source" dropdowns (Constraints & Projection)
            refreshAllVariableDropdowns();
        });
    });

    function refreshAllVariableDropdowns() {
        const optionsHTML = getAvailableVariablesOptions();
        // Update Step 3 Constraints
        document.querySelectorAll('.c-op1, .c-op2').forEach(sel => sel.innerHTML = optionsHTML);
        // Update Step 4 Projection
        document.querySelectorAll('.proj-source').forEach(sel => sel.innerHTML = optionsHTML);
    }

    function getAvailableVariablesOptions() {
        // Helper to generate <option> list based on what is currently selected in Step 1
        let html = "";
        
        ['op1', 'op2'].forEach((prefix, idx) => {
            const alias = `M${idx+1}`; // M1 or M2
            const select = document.getElementById(`${prefix}-predicate`);
            const val = select.value;
            let args = [];

            if (select.options[select.selectedIndex].dataset.schema) {
                // Saved Event
                const schema = JSON.parse(select.options[select.selectedIndex].dataset.schema);
                args = schema.args;
            } else if (BASE_PREDICATES[val]) {
                args = BASE_PREDICATES[val].args;
            }

            args.forEach((argLabel, i) => {
                html += `<option value="${alias}.arg${i+1}">${alias}.Arg${i+1} (${argLabel})</option>`;
            });
            // Always add SF/EF
            html += `<option value="${alias}.sf">${alias}.sf (Start)</option>`;
            html += `<option value="${alias}.ef">${alias}.ef (End)</option>`;
        });
        return html;
    }


    // --- SAVING LOGIC (Step 5) ---
    document.getElementById('save-event-btn').addEventListener('click', () => {
        const name = document.getElementById('event-name').value;
        if (!name) return alert("Name required!");

        // CAPTURE THE SCHEMA FROM STEP 4
        let projectedArgs = [];
        document.querySelectorAll('.proj-row').forEach(row => {
            const label = row.querySelector('.proj-label').value || "Unknown";
            projectedArgs.push(label); // Store just the label description for future viewing
        });

        const eventData = {
            name: name,
            schema: { args: projectedArgs } // Save the list of output columns
        };

        let library = JSON.parse(localStorage.getItem('iseql_library') || "[]");
        library = library.filter(e => e.name !== name); // Overwrite if exists
        library.push(eventData);
        localStorage.setItem('iseql_library', JSON.stringify(library));
        
        alert("Saved!");
        updateDropdowns();
    });

    function updateDropdowns() {
        const library = JSON.parse(localStorage.getItem('iseql_library') || "[]");
        opSelects.forEach(select => {
            select.innerHTML = ''; // Clear
            
            // Add Base Predicates
            for (let p in BASE_PREDICATES) {
                let opt = document.createElement('option');
                opt.value = p; opt.textContent = p;
                select.appendChild(opt);
            }

            // Add Saved Events
            if(library.length > 0) {
                let sep = document.createElement('option');
                sep.disabled = true; sep.textContent = "--- SAVED ---";
                select.appendChild(sep);
                
                library.forEach(evt => {
                    let opt = document.createElement('option');
                    opt.value = evt.name; // Use name as value
                    opt.textContent = `Event: ${evt.name}`;
                    opt.dataset.schema = JSON.stringify(evt.schema); // Store schema in DOM
                    select.appendChild(opt);
                });
            }
        });
        refreshAllVariableDropdowns(); // Initial refresh
    }


    // --- GENERATE LOGIC ---
    document.getElementById('generate-btn').addEventListener('click', () => {
        // ... (Keep your existing Operator/Constraint logic here) ...
        // I will focus on the PROJECTION part which is new

        // Build Projection String from Step 4
        let projParts = [];
        document.querySelectorAll('.proj-row').forEach(row => {
            const label = row.querySelector('.proj-label').value || "col";
            const source = row.querySelector('.proj-source').value;
            projParts.push(`${source} AS ${label}`);
        });
        
        const sfSource = document.getElementById('proj-sf').value;
        const efSource = document.getElementById('proj-ef').value;
        
        // Add SF and EF to projection list
        const projectionString = `${projParts.join(", ")}, ${sfSource}, ${efSource}`;
        
        // ... (Rest of logic: Constraint building, operator selection) ...
        // Assume logic generates 'constraints' and 'operatorString'

        // Placeholder for the rest of the generation to show context
        const op1 = `σ(...)(M1)`; // Use your buildOperandString function
        const op2 = `σ(...)(M2)`; 
        const constraints = "True"; // Use your constraint builder
        const operator = "Bef"; // Use your operator builder

        const finalOutput = `
SELECT * FROM 
π_{ ${projectionString} } (
  σ_{ ${constraints} } (
    ${op1} ${operator} ${op2}
  )
)`;
        document.getElementById('output-area').value = finalOutput;
    });
    
    // Add constraints button listener (Simple version)
    document.getElementById('add-constraint-btn').addEventListener('click', () => {
         const list = document.getElementById('constraints-list');
         const div = document.createElement('div');
         div.className = 'input-group';
         div.innerHTML = `
            <select class="c-op1">${getAvailableVariablesOptions()}</select> 
            <select><option>=</option><option>!=</option></select> 
            <select class="c-op2">${getAvailableVariablesOptions()}</select>`;
         list.appendChild(div);
    });

});