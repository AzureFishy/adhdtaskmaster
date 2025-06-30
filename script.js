// Sentence Organizer - Vanilla JavaScript Implementation

// Global state
const state = {
    dropZones: {
        available: [
            { id: 1, text: "The quick brown fox jumps over the lazy dog." },
            { id: 2, text: "React makes building interactive UIs simple and enjoyable." },
            { id: 3, text: "Drag and drop functionality enhances user experience." },
            { id: 4, text: "Components can be reused throughout your application." },
            { id: 5, text: "State management helps track changes in your app." }
        ],
        zone1: [],
        zone2: [],
        zone3: [],
        zone4: [],
        recycleBin: []
    },
    draggedItem: null,
    dragOverZone: null,
    touchDragData: null,
    pressedItem: null,
    recycleBinHideTimer: null,
    debugLogs: [],
    expandedSentences: new Set(),
    trashedSentences: new Set(),
    isDragIntent: false,
    trashBinPosition: { x: 20, y: 80 },
    isDraggingTrashBin: false,
    trashBinDragStart: { x: 0, y: 0 },
    lastTapTime: 0,
    lastTapSentence: null,
    truncateLength: 5,
    doubleTapDelay: 400,
    longPressTimer: null,
    debugExpanded: false,
    debugSettingsExpanded: false
};

// Constants
const DRAG_THRESHOLD = 10;
const RECYCLE_BIN_HIDE_DELAY = 2000; // 2 seconds
const isMobile = window.matchMedia('(max-width: 768px)').matches && 'ontouchstart' in window;

// Utility functions
function truncateText(text, maxLength) {
    if (!maxLength || text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
}

function vibrate(duration = 10) {
    if ('vibrate' in navigator) {
        navigator.vibrate(duration);
    }
}

function debugLog(message, data = null) {
    const timestamp = new Date().toLocaleTimeString();
    const entry = {
        timestamp,
        message,
        data,
        id: Date.now()
    };
    state.debugLogs.push(entry);
    updateDebugLog();
}

// DOM element getters
function getZoneContainer(zoneId) {
    return document.querySelector(`[data-drop-zone="${zoneId}"] .sentence-container`);
}

function getAllZones() {
    return document.querySelectorAll('[data-drop-zone]');
}

// UI Update functions
function updateDebugLog() {
    const logCount = document.getElementById('logCount');
    const logEntries = document.getElementById('debugLogEntries');
    
    logCount.textContent = `(${state.debugLogs.length} entries)`;
    
    if (state.debugExpanded) {
        if (state.debugLogs.length === 0) {
            logEntries.innerHTML = '<span class="text-gray-500 italic">No debug entries yet. Start dragging!</span>';
        } else {
            const last100 = state.debugLogs.slice(-100).reverse();
            logEntries.textContent = last100.map(log => 
                `[${log.timestamp}] ${log.message}${log.data ? ' - ' + JSON.stringify(log.data) : ''}`
            ).join('\n');
        }
    }
}

function updateStateInfo() {
    const stateInfo = document.getElementById('stateInfo');
    const expandedInfo = document.getElementById('expandedInfo');
    const trashedInfo = document.getElementById('trashedInfo');
    const recycleBinInfo = document.getElementById('recycleBinInfo');
    const collapseAllBtn = document.getElementById('collapseAllBtn');
    const untrashAllBtn = document.getElementById('untrashAllBtn');
    const restoreLastBtn = document.getElementById('restoreLastBtn');
    const emptyBinBtn = document.getElementById('emptyBinBtn');
    
    const hasExpanded = state.expandedSentences.size > 0;
    const hasTrashed = state.trashedSentences.size > 0;
    const hasRecycleBin = state.dropZones.recycleBin.length > 0;
    
    // Show/hide state info section
    if (hasExpanded || hasTrashed || hasRecycleBin) {
        stateInfo.classList.remove('hidden');
    } else {
        stateInfo.classList.add('hidden');
    }
    
    // Update expanded info
    if (hasExpanded) {
        expandedInfo.classList.remove('hidden');
        expandedInfo.querySelector('.count').textContent = state.expandedSentences.size;
        expandedInfo.querySelector('.plural').textContent = state.expandedSentences.size !== 1 ? 's' : '';
        collapseAllBtn.classList.remove('hidden');
    } else {
        expandedInfo.classList.add('hidden');
        collapseAllBtn.classList.add('hidden');
    }
    
    // Update trashed info
    if (hasTrashed) {
        trashedInfo.classList.remove('hidden');
        trashedInfo.querySelector('.count').textContent = state.trashedSentences.size;
        trashedInfo.querySelector('.plural').textContent = state.trashedSentences.size !== 1 ? 's' : '';
        untrashAllBtn.classList.remove('hidden');
    } else {
        trashedInfo.classList.add('hidden');
        untrashAllBtn.classList.add('hidden');
    }
    
    // Update recycle bin info
    if (hasRecycleBin) {
        recycleBinInfo.classList.remove('hidden');
        recycleBinInfo.querySelector('.count').textContent = state.dropZones.recycleBin.length;
        restoreLastBtn.classList.remove('hidden');
        emptyBinBtn.classList.remove('hidden');
    } else {
        recycleBinInfo.classList.add('hidden');
        restoreLastBtn.classList.add('hidden');
        emptyBinBtn.classList.add('hidden');
    }
}

function updateRecycleBin() {
    const recycleBin = document.getElementById('recycleBin');
    const recycleBinCount = document.getElementById('recycleBinCount');
    const count = state.dropZones.recycleBin.length;
    
    if (count > 0) {
        recycleBinCount.textContent = count;
        recycleBinCount.classList.remove('hidden');
        recycleBin.classList.add('has-items');
    } else {
        recycleBinCount.classList.add('hidden');
        recycleBin.classList.remove('has-items');
    }
    
    // Update title
    recycleBin.title = state.isDraggingTrashBin 
        ? "Drag to reposition" 
        : `Recycle Bin (${count} item${count !== 1 ? 's' : ''}) • Drag sentences here to recycle • Drag bin to move`;
}

// Sentence creation
function createSentenceElement(sentence, sourceZone) {
    const isPressed = state.pressedItem === sentence.id;
    const isDragging = state.draggedItem?.id === sentence.id;
    const isExpanded = state.expandedSentences.has(sentence.id);
    const isTrashed = state.trashedSentences.has(sentence.id);
    const displayText = isExpanded ? sentence.text : truncateText(sentence.text, state.truncateLength);
    const isTruncated = !isExpanded && sentence.text.length > state.truncateLength;
    
    const div = document.createElement('div');
    div.className = `sentence ${isTrashed ? 'trashed' : ''} ${isExpanded ? 'expanded' : ''} ${isPressed ? 'pressed' : ''} ${isDragging ? 'dragging' : ''}`;
    div.draggable = true;
    div.dataset.sentenceId = sentence.id;
    div.dataset.sourceZone = sourceZone;
    
    // Set title
    div.title = `${isTruncated ? `Full text: ${sentence.text}\n(Click to expand)` : isExpanded ? 'Click to collapse' : sentence.text}${isTrashed ? '\n(Double-click to restore)' : '\n(Double-click to trash)'}`;
    
    // Create content
        div.innerHTML = `
            <div class="flex items-center flex-1">
                <span class="sentence-text">${displayText}</span>
            </div>
            ${isMobile ? `
                <div class="sentence-handle">
                    <span class="sentence-handle-icon ${isTrashed ? 'trashed' : ''}">✋</span>
                </div>
            ` : ''}
        `;
    
    // Add event listeners
    div.addEventListener('dragstart', (e) => handleDragStart(e, sentence));
    div.addEventListener('dragend', handleDragEnd);
    div.addEventListener('mousedown', () => state.isDragIntent = true);
    div.addEventListener('mouseup', () => setTimeout(() => state.isDragIntent = false, 100));
    div.addEventListener('touchstart', (e) => handleTouchStart(e, sentence));
    div.addEventListener('touchmove', handleTouchMove);
    div.addEventListener('touchend', handleTouchEnd);
    div.addEventListener('click', (e) => handleSentenceClick(e, sentence.id));
    
    return div;
}

// Render functions
function renderZone(zoneId) {
    const container = getZoneContainer(zoneId);
    const sentences = state.dropZones[zoneId];
    
    // Clear existing content
    container.innerHTML = '';
    
    if (sentences.length === 0) {
        // Show empty state
        container.innerHTML = `
            <div class="empty-state w-full flex items-center justify-center py-4 md:py-8">
                <div class="text-center">
                    <div class="text-xl md:text-3xl mb-1 md:mb-2">📥</div>
                    <p class="text-gray-400 italic text-[10px] md:text-sm">
                        <span class="mobile-text">Touch and drag here</span>
                        <span class="desktop-text">Drop sentences here</span>
                    </p>
                </div>
            </div>
        `;
    } else {
        // Render sentences
        sentences.forEach(sentence => {
            container.appendChild(createSentenceElement(sentence, zoneId));
        });
    }
}

function renderAllZones() {
    Object.keys(state.dropZones).forEach(zoneId => {
        if (zoneId !== 'recycleBin') {
            renderZone(zoneId);
        }
    });
    updateRecycleBin();
    updateStateInfo();
}

// Click handling
function handleSentenceClick(e, sentenceId, fromTouch = false) {
    // Prevent click if we're dragging
    if (state.draggedItem || state.touchDragData?.isDragging || state.isDragIntent || state.isDraggingTrashBin) return;
    
    const now = Date.now();
    const timeSinceLastTap = now - state.lastTapTime;
    
    debugLog('Click detected', { 
        sentenceId, 
        timeSinceLastTap, 
        doubleTapThreshold: state.doubleTapDelay,
        lastTapSentence: state.lastTapSentence,
        isDoubleClick: timeSinceLastTap < state.doubleTapDelay && state.lastTapSentence === sentenceId
    });
    
    // Check for double-click/double-tap
    if (timeSinceLastTap < state.doubleTapDelay && state.lastTapSentence === sentenceId) {
        // Double click/tap - toggle trash state
        handleDoubleClick(e, sentenceId);
        state.lastTapTime = 0;
        state.lastTapSentence = null;
        return;
    }
    
    // Single click/tap - toggle expand/collapse
    state.lastTapTime = now;
    state.lastTapSentence = sentenceId;
    
    if (e.stopPropagation) e.stopPropagation();
    
    if (state.expandedSentences.has(sentenceId)) {
        state.expandedSentences.delete(sentenceId);
        debugLog('Sentence collapsed', { sentenceId, trigger: fromTouch ? 'touch' : e.type });
    } else {
        state.expandedSentences.add(sentenceId);
        debugLog('Sentence expanded', { sentenceId, trigger: fromTouch ? 'touch' : e.type });
    }
    
    vibrate(5);
    renderAllZones();
}

function handleDoubleClick(e, sentenceId) {
    if (e.stopPropagation) e.stopPropagation();
    
    if (state.trashedSentences.has(sentenceId)) {
        state.trashedSentences.delete(sentenceId);
        debugLog('Sentence untrashed', { sentenceId });
    } else {
        state.trashedSentences.add(sentenceId);
        debugLog('Sentence trashed', { sentenceId });
    }
    
    vibrate(30);
    renderAllZones();
}

// Desktop drag handlers
function handleDragStart(e, sentence) {
    if (e.type === 'dragstart' && !state.isDraggingTrashBin) {
        state.draggedItem = sentence;
        state.isDragIntent = false;
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', JSON.stringify(sentence));
        debugLog('Desktop drag started', { 
            sentenceId: sentence.id, 
            text: sentence.text,
            isTrashed: state.trashedSentences.has(sentence.id)
        });
        debugLog('Recycle bin appeared');
        showRecycleBin();
    }
}

function handleDragEnd() {
    state.draggedItem = null;
    state.dragOverZone = null;
    state.isDragIntent = false;
    hideRecycleBin();
    debugLog('Recycle bin hidden');
    renderAllZones(); // Add this line to re-render and remove the dragging class
}

function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
}

function handleDragEnter(e, zoneId) {
    e.preventDefault();
    state.dragOverZone = zoneId;
    
    // Add visual feedback
    const zone = e.currentTarget;
    zone.classList.add('drag-over');
    
    // Special handling for recycle bin
    if (zoneId === 'recycleBin') {
        const recycleBin = document.getElementById('recycleBin');
        recycleBin.classList.add('active');
    }
    
    debugLog('Drag enter zone', { zone: zoneId });
}

function handleDragLeave(e) {
    if (!e.currentTarget.contains(e.relatedTarget)) {
        state.dragOverZone = null;
        e.currentTarget.classList.remove('drag-over');
        
        if (e.currentTarget.id === 'recycleBin') {
            e.currentTarget.classList.remove('active');
        }
    }
}

function handleDrop(e, zoneId) {
    e.preventDefault();
    
    if (state.draggedItem) {
        moveItemToZone(state.draggedItem, zoneId);
        debugLog('Desktop drop completed', { item: state.draggedItem.text, targetZone: zoneId });
    }
    
    e.currentTarget.classList.remove('drag-over');
    state.dragOverZone = null;
    state.draggedItem = null;
    hideRecycleBin();
}

// Touch handlers
function handleTouchStart(e, sentence) {
    if (!isMobile) return;
    
    const touch = e.touches[0];
    debugLog('Touch start', { 
        sentenceId: sentence.id, 
        x: Math.round(touch.clientX), 
        y: Math.round(touch.clientY),
        text: sentence.text.substring(0, 20) + '...'
    });
    
    state.touchDragData = {
        sentence,
        startX: touch.clientX,
        startY: touch.clientY,
        currentX: touch.clientX,
        currentY: touch.clientY,
        isDragging: false,
        element: e.currentTarget
    };
    
    state.longPressTimer = setTimeout(() => {
        state.pressedItem = sentence.id;
        vibrate(20);
        debugLog('Long press activated', { sentenceId: sentence.id });
        renderAllZones();
    }, 150);
}

function handleTouchMove(e) {
    if (!isMobile || !state.touchDragData) return;
    
    const touch = e.touches[0];
    const deltaX = Math.abs(touch.clientX - state.touchDragData.startX);
    const deltaY = Math.abs(touch.clientY - state.touchDragData.startY);
    
    if (state.longPressTimer) {
        clearTimeout(state.longPressTimer);
    }
    
    if (!state.touchDragData.isDragging && (deltaX > DRAG_THRESHOLD || deltaY > DRAG_THRESHOLD)) {
        e.preventDefault();
        
        state.touchDragData.isDragging = true;
        state.touchDragData.currentX = touch.clientX;
        state.touchDragData.currentY = touch.clientY;
        state.draggedItem = state.touchDragData.sentence;
        vibrate(10);
        debugLog('Touch drag started', { sentenceId: state.touchDragData.sentence.id, deltaX, deltaY });
        debugLog('Recycle bin appeared');
        
        if (state.touchDragData.element) {
            state.touchDragData.element.style.opacity = '0.3';
        }
        
        showRecycleBin();
        showTouchDragPreview();
    }
    
    if (state.touchDragData.isDragging) {
        e.preventDefault();
        
        state.touchDragData.currentX = touch.clientX;
        state.touchDragData.currentY = touch.clientY;
        updateTouchDragPreview();
        
        const elementBelow = document.elementFromPoint(touch.clientX, touch.clientY);
        const dropZone = elementBelow?.closest('[data-drop-zone]');
        if (dropZone) {
            const zoneId = dropZone.getAttribute('data-drop-zone');
            if (zoneId !== state.dragOverZone) {
                // Remove previous zone highlighting
                if (state.dragOverZone) {
                    const prevZone = document.querySelector(`[data-drop-zone="${state.dragOverZone}"]`);
                    if (prevZone) prevZone.classList.remove('drag-over');
                }
                
                state.dragOverZone = zoneId;
                dropZone.classList.add('drag-over');
                vibrate(5);
                
                if (zoneId === 'recycleBin') {
                    document.getElementById('recycleBin').classList.add('active');
                    vibrate(10);
                }
            }
        } else {
            if (state.dragOverZone) {
                const prevZone = document.querySelector(`[data-drop-zone="${state.dragOverZone}"]`);
                if (prevZone) prevZone.classList.remove('drag-over');
                if (state.dragOverZone === 'recycleBin') {
                    document.getElementById('recycleBin').classList.remove('active');
                }
            }
            state.dragOverZone = null;
        }
    }
}

function handleTouchEnd(e) {
    if (!isMobile) return;
    
    if (state.longPressTimer) {
        clearTimeout(state.longPressTimer);
    }
    
    state.pressedItem = null;
    
    if (!state.touchDragData) {
        return;
    }
    
    const touch = e.changedTouches[0];
    const deltaX = Math.abs(touch.clientX - state.touchDragData.startX);
    const deltaY = Math.abs(touch.clientY - state.touchDragData.startY);
    const wasTap = !state.touchDragData.isDragging && deltaX < DRAG_THRESHOLD && deltaY < DRAG_THRESHOLD;
    
    debugLog('Touch end', { 
        wasDragging: state.touchDragData.isDragging,
        deltaX: Math.round(deltaX),
        deltaY: Math.round(deltaY),
        wasTap,
        sentenceId: state.touchDragData.sentence.id
    });
    
    if (state.touchDragData.element) {
        state.touchDragData.element.style.opacity = '1';
    }
    
    if (state.touchDragData.isDragging) {
        const elementBelow = document.elementFromPoint(touch.clientX, touch.clientY);
        const dropZone = elementBelow?.closest('[data-drop-zone]');
        
        if (dropZone) {
            const zoneId = dropZone.getAttribute('data-drop-zone');
            moveItemToZone(state.touchDragData.sentence, zoneId);
            vibrate(zoneId === 'recycleBin' ? 30 : 20);
            debugLog('Touch drop completed', { item: state.touchDragData.sentence.text, zone: zoneId });
        } else {
            debugLog('Touch drag cancelled', { item: state.touchDragData.sentence.text });
        }
        
        hideTouchDragPreview();
    } else if (wasTap) {
        debugLog('Touch tap detected', { sentenceId: state.touchDragData.sentence.id, deltaX, deltaY });
        const syntheticEvent = { type: 'touchend', stopPropagation: () => {} };
        handleSentenceClick(syntheticEvent, state.touchDragData.sentence.id, true);
    }
    
    // Clean up drag states
    if (state.dragOverZone) {
        const zone = document.querySelector(`[data-drop-zone="${state.dragOverZone}"]`);
        if (zone) zone.classList.remove('drag-over');
        if (state.dragOverZone === 'recycleBin') {
            document.getElementById('recycleBin').classList.remove('active');
        }
    }
    
    state.draggedItem = null;
    state.touchDragData = null;
    state.dragOverZone = null;
    
    if (state.touchDragData?.isDragging) {
        debugLog('Recycle bin hidden');
    }
    
    hideRecycleBin();
    renderAllZones();
    
    if (state.touchDragData?.isDragging) {
        e.preventDefault();
    }
}

// Touch drag preview
function showTouchDragPreview() {
    const preview = document.getElementById('touchDragPreview');
    const sentence = state.touchDragData.sentence;
    const isTrashed = state.trashedSentences.has(sentence.id);
    const isExpanded = state.expandedSentences.has(sentence.id);
    const displayText = isExpanded ? sentence.text : truncateText(sentence.text, state.truncateLength);
    
    preview.className = `fixed pointer-events-none z-50 px-3 py-2 text-white rounded-xl shadow-2xl transform -rotate-3 scale-110 ${
        isTrashed ? 'bg-gradient-to-r from-red-600 to-red-700' : 'bg-gradient-to-r from-blue-600 to-blue-700'
    }`;
    preview.querySelector('span').textContent = displayText;
    preview.classList.remove('hidden');
    
    updateTouchDragPreview();
}

function updateTouchDragPreview() {
    const preview = document.getElementById('touchDragPreview');
    preview.style.left = (state.touchDragData.currentX - 50) + 'px';
    preview.style.top = (state.touchDragData.currentY - 25) + 'px';
}

function hideTouchDragPreview() {
    document.getElementById('touchDragPreview').classList.add('hidden');
}

// Move item between zones
function moveItemToZone(item, targetZone) {
    let sourceZone = null;
    const wasExpanded = state.expandedSentences.has(item.id);
    
    // Find and remove from source zone
    Object.keys(state.dropZones).forEach(zone => {
        const index = state.dropZones[zone].findIndex(i => i.id === item.id);
        if (index !== -1) {
            sourceZone = zone;
            state.dropZones[zone] = state.dropZones[zone].filter(i => i.id !== item.id);
        }
    });
    
    // Add to target zone
    state.dropZones[targetZone].push(item);
    
    // Collapse the item if it was expanded (except for recycle bin)
    if (wasExpanded && targetZone !== 'recycleBin') {
        state.expandedSentences.delete(item.id);
        debugLog('Dropped item auto-collapsed', { itemId: item.id });
    }
    
    debugLog(targetZone === 'recycleBin' ? 'Item recycled' : 'Item moved', { 
        item: item.text, 
        from: sourceZone || 'unknown', 
        to: targetZone,
        wasExpanded,
        isTrashed: state.trashedSentences.has(item.id)
    });
    
    renderAllZones();
}

// Recycle bin visibility
function showRecycleBin() {
    document.getElementById('recycleBin').classList.remove('hidden');
}

function hideRecycleBin() {
    // Clear any existing timer
    if (state.recycleBinHideTimer) {
        clearTimeout(state.recycleBinHideTimer);
        state.recycleBinHideTimer = null;
    }
    
    // Don't hide if we're currently dragging the bin
    if (state.isDraggingTrashBin) {
        return;
    }
    
    // Set a timer to hide the recycle bin
    state.recycleBinHideTimer = setTimeout(() => {
        document.getElementById('recycleBin').classList.add('hidden');
        document.getElementById('recycleBin').classList.remove('active');
        state.recycleBinHideTimer = null;
    }, RECYCLE_BIN_HIDE_DELAY);
}

function hideRecycleBinImmediately() {
    if (state.recycleBinHideTimer) {
        clearTimeout(state.recycleBinHideTimer);
        state.recycleBinHideTimer = null;
    }
    document.getElementById('recycleBin').classList.add('hidden');
    document.getElementById('recycleBin').classList.remove('active');
}

// Trash bin dragging
function handleTrashBinMouseDown(e) {
    // Clear hide timer when starting to drag
    if (state.recycleBinHideTimer) {
        clearTimeout(state.recycleBinHideTimer);
        state.recycleBinHideTimer = null;
    }
    
    state.isDraggingTrashBin = true;
    state.trashBinDragStart = {
        x: e.clientX - state.trashBinPosition.x,
        y: e.clientY - state.trashBinPosition.y
    };
    document.getElementById('recycleBin').classList.add('dragging');
    e.preventDefault();
}

function handleTrashBinMouseMove(e) {
    if (state.isDraggingTrashBin) {
        state.trashBinPosition = {
            x: e.clientX - state.trashBinDragStart.x,
            y: e.clientY - state.trashBinDragStart.y
        };
        updateTrashBinPosition();
    }
}

function handleTrashBinMouseUp() {
    if (state.isDraggingTrashBin) {
        debugLog('Recycle bin repositioned', { 
            x: Math.round(state.trashBinPosition.x), 
            y: Math.round(state.trashBinPosition.y) 
        });
        document.getElementById('recycleBin').classList.remove('dragging');
        
        // Restart the hide timer after dragging
        hideRecycleBin();
    }
    state.isDraggingTrashBin = false;
}

function handleTrashBinTouchStart(e) {
    // Clear hide timer when starting to drag
    if (state.recycleBinHideTimer) {
        clearTimeout(state.recycleBinHideTimer);
        state.recycleBinHideTimer = null;
    }
    
    const touch = e.touches[0];
    state.isDraggingTrashBin = true;
    state.trashBinDragStart = {
        x: touch.clientX - state.trashBinPosition.x,
        y: touch.clientY - state.trashBinPosition.y
    };
    document.getElementById('recycleBin').classList.add('dragging');
    e.preventDefault();
}

function handleTrashBinTouchMove(e) {
    if (state.isDraggingTrashBin) {
        const touch = e.touches[0];
        state.trashBinPosition = {
            x: touch.clientX - state.trashBinDragStart.x,
            y: touch.clientY - state.trashBinDragStart.y
        };
        updateTrashBinPosition();
    }
}

function handleTrashBinTouchEnd() {
    if (state.isDraggingTrashBin) {
        debugLog('Recycle bin repositioned', { 
            x: Math.round(state.trashBinPosition.x), 
            y: Math.round(state.trashBinPosition.y) 
        });
        document.getElementById('recycleBin').classList.remove('dragging');
        
        // Restart the hide timer after dragging
        hideRecycleBin();
    }
    state.isDraggingTrashBin = false;
}


function updateTrashBinPosition() {
    const recycleBin = document.getElementById('recycleBin');
    recycleBin.style.left = state.trashBinPosition.x + 'px';
    recycleBin.style.top = state.trashBinPosition.y + 'px';
}

// Settings management
function updateSettingsUI() {
    const truncateInput = document.getElementById('truncateLength');
    const delayInput = document.getElementById('doubleTapDelay');
    const settingsUnsaved = document.getElementById('settingsUnsaved');
    const settingsStatus = document.getElementById('settingsStatus');
    const applyBtn = document.getElementById('applySettingsBtn');
    const truncateCurrent = document.getElementById('truncateCurrent');
    const delayCurrent = document.getElementById('delayCurrent');
    
    const truncateValue = truncateInput.value;
    const delayValue = delayInput.value;
    
    const hasChanges = truncateValue !== String(state.truncateLength) || 
                      delayValue !== String(state.doubleTapDelay);
    
    if (hasChanges) {
        settingsUnsaved.classList.remove('hidden');
        settingsStatus.innerHTML = '<span class="text-yellow-400">* Unsaved changes</span>';
        applyBtn.disabled = false;
        applyBtn.className = 'px-2 py-0.5 md:px-3 md:py-1 rounded text-[10px] md:text-xs font-medium transition-all bg-blue-600 hover:bg-blue-700 text-white cursor-pointer';
        
        if (truncateValue !== String(state.truncateLength)) {
            truncateCurrent.classList.remove('hidden');
            truncateCurrent.querySelector('.current-value').textContent = state.truncateLength;
        } else {
            truncateCurrent.classList.add('hidden');
        }
        
        if (delayValue !== String(state.doubleTapDelay)) {
            delayCurrent.classList.remove('hidden');
            delayCurrent.querySelector('.current-value').textContent = state.doubleTapDelay;
        } else {
            delayCurrent.classList.add('hidden');
        }
    } else {
        settingsUnsaved.classList.add('hidden');
        settingsStatus.textContent = 'Settings saved';
        applyBtn.disabled = true;
        applyBtn.className = 'px-2 py-0.5 md:px-3 md:py-1 rounded text-[10px] md:text-xs font-medium transition-all bg-gray-700 text-gray-500 cursor-not-allowed';
        truncateCurrent.classList.add('hidden');
        delayCurrent.classList.add('hidden');
    }
}

function applySettings() {
    const truncateInput = document.getElementById('truncateLength');
    const delayInput = document.getElementById('doubleTapDelay');
    
    const newTruncate = truncateInput.value === '' ? 5 : parseInt(truncateInput.value);
    const clampedTruncate = Math.max(1, Math.min(200, newTruncate));
    state.truncateLength = clampedTruncate;
    truncateInput.value = clampedTruncate;
    
    const newDelay = delayInput.value === '' ? 400 : parseInt(delayInput.value);
    const clampedDelay = Math.max(100, Math.min(1000, newDelay));
    state.doubleTapDelay = clampedDelay;
    delayInput.value = clampedDelay;
    
    const allSentences = Object.values(state.dropZones).flat();
    const truncatedCount = allSentences.filter(s => s.text.length > clampedTruncate).length;
    
    debugLog('Debug settings applied', { 
        truncateLength: clampedTruncate,
        doubleTapDelay: clampedDelay,
        truncatedSentences: `${truncatedCount}/${allSentences.length}`,
        expandedSentences: state.expandedSentences.size,
        trashedSentences: state.trashedSentences.size
    });
    
    updateSettingsUI();
    renderAllZones();
}

// Initialize event listeners
function initializeEventListeners() {
    // Debug toggles
    document.getElementById('debugLogToggle').addEventListener('click', () => {
        state.debugExpanded = !state.debugExpanded;
        const content = document.getElementById('debugLogContent');
        const icon = document.querySelector('#debugLogToggle .toggle-icon');
        
        if (state.debugExpanded) {
            content.classList.remove('hidden');
            icon.textContent = '▼';
            updateDebugLog();
        } else {
            content.classList.add('hidden');
            icon.textContent = '▶';
        }
    });
    
    document.getElementById('debugSettingsToggle').addEventListener('click', () => {
        state.debugSettingsExpanded = !state.debugSettingsExpanded;
        const content = document.getElementById('debugSettingsContent');
        const icon = document.querySelector('#debugSettingsToggle .toggle-icon');
        
        if (state.debugSettingsExpanded) {
            content.classList.remove('hidden');
            icon.textContent = '▼';
        } else {
            content.classList.add('hidden');
            icon.textContent = '▶';
        }
    });
    
    // Clear log button
    document.getElementById('clearLogBtn').addEventListener('click', () => {
        state.debugLogs = [];
        updateDebugLog();
    });
    
    // Settings inputs
    const truncateInput = document.getElementById('truncateLength');
    const delayInput = document.getElementById('doubleTapDelay');
    
    truncateInput.addEventListener('input', (e) => {
        const value = e.target.value;
        if (value !== '' && !/^\d+$/.test(value)) {
            e.target.value = value.replace(/\D/g, '');
        }
        updateSettingsUI();
    });
    
    delayInput.addEventListener('input', (e) => {
        const value = e.target.value;
        if (value !== '' && !/^\d+$/.test(value)) {
            e.target.value = value.replace(/\D/g, '');
        }
        updateSettingsUI();
    });
    
    truncateInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            applySettings();
        }
    });
    
    delayInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            applySettings();
        }
    });
    
    // Apply settings button
    document.getElementById('applySettingsBtn').addEventListener('click', applySettings);
    
    // State management buttons
    document.getElementById('collapseAllBtn').addEventListener('click', () => {
        state.expandedSentences.clear();
        debugLog('All sentences collapsed');
        renderAllZones();
    });
    
    document.getElementById('untrashAllBtn').addEventListener('click', () => {
        state.trashedSentences.clear();
        debugLog('All sentences untrashed');
        renderAllZones();
    });
    
    document.getElementById('restoreLastBtn').addEventListener('click', () => {
        if (state.dropZones.recycleBin.length > 0) {
            const lastItem = state.dropZones.recycleBin[state.dropZones.recycleBin.length - 1];
            state.dropZones.recycleBin = state.dropZones.recycleBin.slice(0, -1);
            state.dropZones.available.push(lastItem);
            debugLog('Item restored from recycle bin', { item: lastItem.text });
            renderAllZones();
        }
    });
    
    document.getElementById('emptyBinBtn').addEventListener('click', () => {
        const count = state.dropZones.recycleBin.length;
        state.dropZones.recycleBin = [];
        debugLog('Recycle bin emptied', { itemCount: count });
        renderAllZones();
    });
    
    // Drop zone event listeners
    getAllZones().forEach(zone => {
        const zoneId = zone.getAttribute('data-drop-zone');
        
        if (zoneId !== 'recycleBin') {
            zone.addEventListener('dragover', handleDragOver);
            zone.addEventListener('dragenter', (e) => handleDragEnter(e, zoneId));
            zone.addEventListener('dragleave', handleDragLeave);
            zone.addEventListener('drop', (e) => handleDrop(e, zoneId));
        }
    });
    
    // Recycle bin event listeners
    const recycleBin = document.getElementById('recycleBin');
    
    recycleBin.addEventListener('mousedown', handleTrashBinMouseDown);
    recycleBin.addEventListener('touchstart', handleTrashBinTouchStart);
    
    recycleBin.addEventListener('dragover', (e) => {
        e.preventDefault();
        if (state.draggedItem) {
            e.dataTransfer.dropEffect = 'move';
        }
    });
    
    recycleBin.addEventListener('dragenter', (e) => {
        e.preventDefault();
        if (state.draggedItem) {
            handleDragEnter(e, 'recycleBin');
        }
    });
    
    recycleBin.addEventListener('dragleave', handleDragLeave);
    
    recycleBin.addEventListener('drop', (e) => {
        e.preventDefault();
        if (state.draggedItem) {
            moveItemToZone(state.draggedItem, 'recycleBin');
            debugLog('Item moved to recycle bin', { item: state.draggedItem.text });
            vibrate(30);
        }
        recycleBin.classList.remove('active');
        state.dragOverZone = null;
        state.draggedItem = null;
        hideRecycleBin();
    });
    
    // Window event listeners for trash bin dragging
    window.addEventListener('mousemove', handleTrashBinMouseMove);
    window.addEventListener('mouseup', handleTrashBinMouseUp);
    window.addEventListener('touchmove', handleTrashBinTouchMove, { passive: false });
    window.addEventListener('touchend', handleTrashBinTouchEnd);
}

// Initialize the app
function initialize() {
    // Update mode indicator
    document.getElementById('modeIndicator').textContent = isMobile ? 'Mobile Mode' : 'Desktop Mode';
    
    // Initialize debug log
    debugLog('Component initialized', { 
        mode: isMobile ? 'mobile' : 'desktop',
        touchSupport: 'ontouchstart' in window,
        screenWidth: window.innerWidth,
        truncateLength: state.truncateLength,
        doubleTapDelay: state.doubleTapDelay,
        clickToExpand: true,
        doubleClickToTrash: true,
        recycleBin: 'appears on drag'
    });
    
    // Show mobile hint if on mobile
    if (isMobile) {
        const mobileHint = document.getElementById('mobileHint');
        mobileHint.classList.remove('hidden');
        setTimeout(() => mobileHint.classList.add('hidden'), 5000);
    }
    
    // Initialize event listeners
    initializeEventListeners();
    
    // Initial render
    renderAllZones();
}

// Start the app when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
} else {
    initialize();
}