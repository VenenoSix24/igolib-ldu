// static/js/config.js

const API_URL = '/api';

// --- DOM Element Selection ---
const form = document.getElementById('config_form');
const modeRadios = document.querySelectorAll('input[name="mode"]');
const timeInputContainer = document.getElementById('time_input_container');
const timeStrInput = document.getElementById('time_str');
const libIdSelect = document.getElementById('lib_id');
const cookieStrInput = document.getElementById('cookie_str');
const seatNumberInput = document.getElementById('seat_number');
const submitButton = document.getElementById('submit_button');
const viewResultButton = document.getElementById('view_result_button');
const formGeneralError = document.getElementById('form_general_error');

const cookieError = document.getElementById('cookie_error');
const timeError = document.getElementById('time_error');
const libIdError = document.getElementById('lib_id_error');
const seatNumberError = document.getElementById('seat_number_error');

// Mode Switch Elements
const modeTomorrowRadio = document.getElementById('mode_tomorrow');
const modeInstantRadio = document.getElementById('mode_instant');
const labelModeTomorrow = document.getElementById('label_mode_tomorrow');
const labelModeInstant = document.getElementById('label_mode_instant');
const modeSlider = document.querySelector('.mode-switch-slider');

// 执行时间开关元素
const executionNowRadio = document.getElementById('execution_now');
const executionDefaultRadio = document.getElementById('execution_default');
const executionCustomRadio = document.getElementById('execution_custom');
const labelExecutionNow = document.getElementById('label_execution_now');
const labelExecutionDefault = document.getElementById('label_execution_default');
const labelExecutionCustom = document.getElementById('label_execution_custom');
const customTimeInputContainer = document.getElementById('custom_time_input_container');

// Time Clear Button Element
const clearTimeButton = document.getElementById('clear_time_button');

// Library Loader Spinner
const libLoaderSpinner = document.getElementById('lib_loader_spinner');

// localStorage key
const LOCAL_STORAGE_KEY = 'igarss_configFormData';

// These will be populated by the script tag in HTML
let TOMORROW_RESERVE_WINDOW_START_STR = "19:48:00";
let TOMORROW_RESERVE_WINDOW_END_STR = "23:59:59";

// Update placeholder/title attributes with actual window times
document.addEventListener('DOMContentLoaded', () => {
  const timeHintPara = timeInputContainer.querySelector('.text-xs.text-gray-500.mt-1');
  if (timeHintPara) {
    timeHintPara.textContent = `明日预约窗口: ${TOMORROW_RESERVE_WINDOW_START_STR} - ${TOMORROW_RESERVE_WINDOW_END_STR}. 提示：明日预约模式下时间必填；立即抢座模式下可留空或指定时间。`;
  }

  const iconTomorrow = labelModeTomorrow.querySelector('.fas');
  const iconInstant = labelModeInstant.querySelector('.fas');

  // Initialize mode switch label colors, font weight. Icon classes will be set by updateModeSwitchVisuals.
  // labelModeTomorrow.classList.add('text-gray-600', 'font-normal'); 
  // labelModeInstant.classList.add('text-gray-600', 'font-normal'); 
  // Apply new text classes for initialization
  if (modeTomorrowRadio.checked) {
    labelModeTomorrow.classList.add('text-selected');
    labelModeInstant.classList.add('text-unselected');
    if (iconTomorrow) iconTomorrow.className = 'fas fa-calendar-alt icon-selected';
    if (iconInstant) iconInstant.className = 'fas fa-bolt icon-unselected';
  } else { // Instant mode selected
    labelModeInstant.classList.add('text-selected');
    labelModeTomorrow.classList.add('text-unselected');
    if (iconInstant) iconInstant.className = 'fas fa-bolt icon-selected';
    if (iconTomorrow) iconTomorrow.className = 'fas fa-calendar-alt icon-unselected';
  }

  updateModeSwitchVisuals();

  // --- Form Persistence & Theme Initialization --- 
  loadFormDataFromLocalStorage(); // Load general form data first (except libId which needs options)

  if (libLoaderSpinner) libLoaderSpinner.style.display = 'inline-block';
  loadLibraries(); // This will populate libIdSelect and then call applySavedLibId in its finally block

  // Auto-resize textarea for cookie input
  autoResizeTextarea(cookieStrInput);

  // Check WebSocket status
  checkWebSocketStatus();

  // Get initial theme from parent AFTER other DOM setup
  if (window.parent && typeof window.parent.getCurrentTheme === 'function') {
    const currentTheme = window.parent.getCurrentTheme();
    if (window.setAppTheme) window.setAppTheme(currentTheme);
  } else {
    console.warn("Could not get initial theme from parent for page_config.html on DOMContentLoaded");
  }

  // 初始化执行时间选项UI
  updateExecutionTimeVisuals();

  // 设置自定义时间输入框默认值并添加特殊处理
  const customTimeInput = document.getElementById('custom_time_input');
  if (customTimeInput) {
    // 添加失去焦点时处理iOS时间格式
    customTimeInput.addEventListener('blur', function () {
      if (this.value) {
        // 如果缺少秒，自动补全
        const timeParts = this.value.split(':');
        if (timeParts.length === 2) {
          this.value = this.value + ':00';
          console.log("iOS设备时间输入补全秒数:", this.value);
          saveFormDataToLocalStorage();
        }
      }
    });

    customTimeInput.addEventListener('input', saveFormDataToLocalStorage);
    customTimeInput.value = '21:48:00';
  }

  // 检测设备类型，显示提示
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  if (isIOS && customTimeInput) {
    const container = document.getElementById('custom_time_input_container');
    if (container) {
      const iosHint = document.createElement('p');
      iosHint.className = 'text-xs text-yellow-500 mt-1';
      iosHint.innerHTML = '<i class="fas fa-info-circle mr-1"></i>iOS设备提示: 如时间选择器无法选择秒，系统将自动补全为":00"';
      container.appendChild(iosHint);
    }
  }

  // 初始化查看结果按钮
  if (viewResultButton) {
    console.log("初始化查看结果按钮");

    // 检查是否存在预约结果，否则添加测试数据（仅用于开发调试）
    if (!localStorage.getItem('lastReservationResult')) {
      console.log("添加测试预约数据用于调试");
      addTestData();
    }

    updateViewResultButtonState();

    // 为按钮添加点击事件（除了onclick属性外的额外保障）
    viewResultButton.addEventListener('click', function (e) {
      console.log("查看结果按钮被点击");
      // 阻止事件冒泡
      e.stopPropagation();
      showReservationResults(e);
    });
  } else {
    console.error("找不到查看结果按钮元素");
  }
});

// --- Functions ---

function autoResizeTextarea(textarea) {
  if (!textarea) return;
  textarea.style.height = 'auto'; // Reset height
  textarea.style.height = textarea.scrollHeight + 'px'; // Set to scroll height
}

// Initialize WebSocket variable
let socket = null;

function checkWebSocketStatus() {
  const wsStatusIndicator = document.getElementById('ws_status_indicator');
  if (!wsStatusIndicator) return;

  wsStatusIndicator.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i>正在检测 WebSocket 服务状态...';

  // 检查是否是iOS设备
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

  // iOS设备特殊处理
  if (isIOS) {
    console.log("检测到iOS设备，采用特殊WebSocket检测处理");
    setTimeout(() => {
      wsStatusIndicator.innerHTML = '<i class="fas fa-info-circle text-blue-500 mr-1"></i>iOS设备: WebSocket可能正常 (提交功能可用)';
    }, 500);
    return;
  }

  // Determine WebSocket protocol (ws or wss)
  const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const wsUrl = wsProtocol + "//" + window.location.host + "/ws_test_connection";

  try {
    if (socket) {
      socket.close();
    }
    socket = new WebSocket(wsUrl);
  } catch (e) {
    console.error("WebSocket instantiation failed:", e);
    wsStatusIndicator.innerHTML = '<i class="fas fa-exclamation-triangle text-red-500 mr-1"></i>WebSocket 服务连接失败 (无法创建)。';
    return;
  }

  // 设置连接超时
  const connectionTimeout = setTimeout(() => {
    if (socket && socket.readyState !== WebSocket.OPEN) {
      wsStatusIndicator.innerHTML = '<i class="fas fa-exclamation-triangle text-yellow-500 mr-1"></i>WebSocket 连接超时，但提交功能可能仍然可用。';
      socket.close();
    }
  }, 5000);

  socket.onopen = function () {
    clearTimeout(connectionTimeout);
    wsStatusIndicator.innerHTML = '<i class="fas fa-check-circle text-green-500 mr-1"></i>WebSocket 服务连接正常。';
    socket.close();
  };

  socket.onerror = function (event) {
    clearTimeout(connectionTimeout);
    console.error("WebSocket Error: ", event);
    wsStatusIndicator.innerHTML = '<i class="fas fa-exclamation-triangle text-red-500 mr-1"></i>WebSocket 服务连接失败。';
  };

  socket.onclose = function (event) {
    clearTimeout(connectionTimeout);
    if (!event.wasClean) {
      console.warn('WebSocket connection closed uncleanly.', event);
      if (wsStatusIndicator.innerHTML.includes('正在检测')) {
        wsStatusIndicator.innerHTML = '<i class="fas fa-exclamation-triangle text-red-500 mr-1"></i>WebSocket 服务无法建立连接。';
      }
    }
  };
}

// Add WebSocket cleanup on page unload
window.addEventListener('beforeunload', () => {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.close(1000, 'Page navigation');
  }
});

function saveFormDataToLocalStorage() {
  // Determine timeStr based on selected radio
  let currentTimeStr = timeStrInput.value;

  const selectedMode = document.querySelector('input[name="mode"]:checked').value;
  if (selectedMode === '1') { // Tomorrow
    if (executionNowRadio.checked) currentTimeStr = '00:00:01';
    else if (executionDefaultRadio.checked) currentTimeStr = '21:48:00';
    else if (executionCustomRadio.checked) {
      const customTimeInput = document.getElementById('custom_time_input');
      if (customTimeInput) currentTimeStr = customTimeInput.value;
    }
  } else { // Instant
    if (executionNowRadio.checked) currentTimeStr = '';
    else if (executionDefaultRadio.checked) currentTimeStr = '21:48:00';
    else if (executionCustomRadio.checked) {
      const customTimeInput = document.getElementById('custom_time_input');
      if (customTimeInput) currentTimeStr = customTimeInput.value;
    }
  }

  const formData = {
    mode: selectedMode,
    cookieStr: cookieStrInput.value,
    timeStr: currentTimeStr,
    libId: libIdSelect.value,
    seatNumber: seatNumberInput.value
  };
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(formData));
}

function loadFormDataFromLocalStorage() {
  const savedDataString = localStorage.getItem(LOCAL_STORAGE_KEY);
  if (savedDataString) {
    try {
      const savedData = JSON.parse(savedDataString);

      // Set mode
      if (savedData.mode === '1') {
        modeTomorrowRadio.checked = true;
      } else if (savedData.mode === '2') {
        modeInstantRadio.checked = true;
      }
      // Important: After setting radio, update visuals like slider and text color
      updateModeSwitchVisuals();

      cookieStrInput.value = savedData.cookieStr || '';

      // 处理执行时间选项
      if (savedData.timeStr === '00:00:01') {
        // 立即执行
        executionNowRadio.checked = true;
      } else if (savedData.timeStr === '21:48:00') {
        // 默认时间执行
        executionDefaultRadio.checked = true;
      } else if (savedData.timeStr) {
        // 自定义时间执行
        executionCustomRadio.checked = true;
        // 设置自定义时间输入框
        const customTimeInput = document.getElementById('custom_time_input');
        if (customTimeInput) customTimeInput.value = savedData.timeStr;
      } else {
        // 如果没有时间值，默认选择立即执行
        executionNowRadio.checked = true;
      }
      updateExecutionTimeVisuals();

      // For libId, ensure it's set after libraries are loaded if it depends on dynamic options
      // We will call applySavedLibId separately after loadLibraries completes.
      seatNumberInput.value = savedData.seatNumber || '';

    } catch (e) {
      console.error("Error parsing saved form data from localStorage:", e);
      localStorage.removeItem(LOCAL_STORAGE_KEY); // Clear corrupted data
    }
  }
}

function applySavedLibId() {
  const savedDataString = localStorage.getItem(LOCAL_STORAGE_KEY);
  if (savedDataString) {
    try {
      const savedData = JSON.parse(savedDataString);
      if (savedData.libId && libIdSelect.options.length > 1) { // Ensure options are loaded
        // Check if the saved libId exists in the current options
        let optionExists = false;
        for (let i = 0; i < libIdSelect.options.length; i++) {
          if (libIdSelect.options[i].value === savedData.libId) {
            optionExists = true;
            break;
          }
        }
        if (optionExists) {
          libIdSelect.value = savedData.libId;
        } else {
          console.warn(`Saved Lib ID ${savedData.libId} not found in current options.`);
        }
      }
    } catch (e) {
      console.error("Error applying saved Lib ID:", e);
    }
  }
}

function generateClientId() {
  return 'client-' + Date.now() + '-' + Math.random().toString(36).substring(2, 15);
}

function toggleTimeInput() {
  const selectedMode = document.querySelector('input[name="mode"]:checked').value;
  if (selectedMode === '1') { // Tomorrow reservation
    timeStrInput.required = true;
    timeStrInput.placeholder = "例如: 19:48:00";
  } else { // Instant booking
    timeStrInput.required = false;
    timeStrInput.placeholder = "留空则立即执行, 或输入 HH:MM:SS";
  }
}

function updateModeSwitchVisuals() {
  const iconTomorrow = labelModeTomorrow.querySelector('.fas');
  const iconInstant = labelModeInstant.querySelector('.fas');

  if (modeTomorrowRadio.checked) {
    modeSlider.style.transform = 'translateX(0%)';

    // labelModeTomorrow.classList.add('text-white', 'font-semibold');
    // labelModeTomorrow.classList.remove('text-gray-600', 'font-normal');
    labelModeTomorrow.classList.add('text-selected');
    labelModeTomorrow.classList.remove('text-unselected');
    if (iconTomorrow) {
      iconTomorrow.classList.add('icon-selected');
      iconTomorrow.classList.remove('icon-unselected');
    }

    // labelModeInstant.classList.add('text-gray-600', 'font-normal');
    // labelModeInstant.classList.remove('text-white', 'font-semibold');
    labelModeInstant.classList.add('text-unselected');
    labelModeInstant.classList.remove('text-selected');
    if (iconInstant) {
      iconInstant.classList.add('icon-unselected');
      iconInstant.classList.remove('icon-selected');
    }
  } else { // Instant mode selected
    modeSlider.style.transform = 'translateX(100%)';

    labelModeInstant.classList.add('text-selected');
    labelModeInstant.classList.remove('text-unselected');
    if (iconInstant) {
      iconInstant.classList.add('icon-selected');
      iconInstant.classList.remove('icon-unselected');
    }

    // labelModeTomorrow.classList.add('text-gray-600', 'font-normal');
    // labelModeTomorrow.classList.remove('text-white', 'font-semibold');
    labelModeTomorrow.classList.add('text-unselected');
    labelModeTomorrow.classList.remove('text-selected');
    if (iconTomorrow) {
      iconTomorrow.classList.add('icon-unselected');
      iconTomorrow.classList.remove('icon-selected');
    }
  }
  toggleTimeInput();
}

function updateExecutionTimeVisuals() {
  const iconNow = labelExecutionNow.querySelector('.fas');
  const iconDefault = labelExecutionDefault.querySelector('.fas');
  const iconCustom = labelExecutionCustom.querySelector('.fas');
  const slider = document.querySelector('.execution-mode-slider');

  // 重置所有样式
  [labelExecutionNow, labelExecutionDefault, labelExecutionCustom].forEach(label => {
    label.classList.remove('text-selected');
    label.classList.add('text-unselected');
  });

  [iconNow, iconDefault, iconCustom].forEach(icon => {
    if (icon) {
      icon.classList.remove('icon-selected');
      icon.classList.add('icon-unselected');
    }
  });

  // 隐藏自定义时间输入框
  if (customTimeInputContainer) {
    customTimeInputContainer.classList.add('hidden');
  }

  if (executionNowRadio.checked) {
    // 立即执行
    slider.style.transform = 'translateX(0%)';
    labelExecutionNow.classList.add('text-selected');
    labelExecutionNow.classList.remove('text-unselected');
    if (iconNow) {
      iconNow.classList.add('icon-selected');
      iconNow.classList.remove('icon-unselected');
    }
  } else if (executionDefaultRadio.checked) {
    // 默认时间执行
    slider.style.transform = 'translateX(100%)';
    labelExecutionDefault.classList.add('text-selected');
    labelExecutionDefault.classList.remove('text-unselected');
    if (iconDefault) {
      iconDefault.classList.add('icon-selected');
      iconDefault.classList.remove('icon-unselected');
    }
  } else if (executionCustomRadio.checked) {
    // 自定义时间执行
    slider.style.transform = 'translateX(200%)';
    labelExecutionCustom.classList.add('text-selected');
    labelExecutionCustom.classList.remove('text-unselected');
    if (iconCustom) {
      iconCustom.classList.add('icon-selected');
      iconCustom.classList.remove('icon-unselected');
    }
    // 显示自定义时间输入框
    if (customTimeInputContainer) {
      customTimeInputContainer.classList.remove('hidden');
    }
  }
}

async function loadLibraries() {
  try {
    const response = await fetch(`${API_URL}/mappings`);
    if (!response.ok) {
      let errorDetail = `HTTP error! status: ${response.status}`;
      try { const errData = await response.json(); errorDetail = errData.detail || errorDetail; } catch (e) { }
      throw new Error(errorDetail);
    }
    const data = await response.json();

    libIdSelect.innerHTML = '<option value="" disabled selected>请选择阅览室</option>'; // Reset before populating
    if (data.rooms && Object.keys(data.rooms).length > 0) {
      for (const [id, name] of Object.entries(data.rooms)) {
        const option = document.createElement('option');
        option.value = id;
        option.textContent = name;
        libIdSelect.appendChild(option);
      }
    } else {
      libIdError.textContent = '未加载到阅览室数据，或数据为空。';
      libIdError.classList.remove('hidden');
    }
  } catch (error) {
    console.error('Failed to load libraries:', error);
    libIdSelect.innerHTML = '<option value="" disabled selected>加载阅览室失败</option>';
    libIdError.textContent = `无法加载阅览室列表: ${error.message}`;
    libIdError.classList.remove('hidden');
  } finally {
    if (libLoaderSpinner) libLoaderSpinner.style.display = 'none';
    // After libraries are loaded and select is populated, try to apply saved libId
    applySavedLibId();
    // Also, ensure that if libId was just set from localStorage, we save again to capture it if not already event-triggered.
    // However, individual event listeners should handle this better.
  }
}

function validateTimeFormat(timeStr) {
  return /^\d{2}:\d{2}(:\d{2})?$/.test(timeStr);
}

function validateForm() {
  let isValid = true;
  [cookieError, timeError, libIdError, seatNumberError, formGeneralError].forEach(el => { el.textContent = ''; el.classList.add('hidden'); });

  if (!cookieStrInput.value.trim()) {
    cookieError.textContent = 'Cookie 不能为空。';
    cookieError.classList.remove('hidden');
    isValid = false;
  }

  const selectedMode = document.querySelector('input[name="mode"]:checked').value;
  const customTimeInput = document.getElementById('custom_time_input');

  // 更新隐藏的时间字段值
  if (selectedMode === '1') { // 明日预约模式
    if (executionNowRadio.checked) {
      // 立即执行，设置特殊值
      timeStrInput.value = '00:00:01';
    } else if (executionDefaultRadio.checked) {
      // 默认时间
      timeStrInput.value = '21:48:00';
    } else if (executionCustomRadio.checked) {
      // 自定义时间
      if (customTimeInput && customTimeInput.value) {
        // 处理iOS设备时间输入格式问题
        timeStrInput.value = processTimeInput(customTimeInput.value);
      } else {
        timeError.textContent = '请输入自定义时间。';
        timeError.classList.remove('hidden');
        isValid = false;
        return isValid;
      }
    }
  } else { // 立即抢座模式
    if (executionNowRadio.checked) {
      // 立即执行
      timeStrInput.value = '';
    } else if (executionDefaultRadio.checked) {
      // 默认时间
      timeStrInput.value = '21:48:00';
    } else if (executionCustomRadio.checked) {
      // 自定义时间
      if (customTimeInput && customTimeInput.value) {
        // 处理iOS设备时间输入格式问题
        timeStrInput.value = processTimeInput(customTimeInput.value);
      } else {
        timeError.textContent = '请输入自定义时间。';
        timeError.classList.remove('hidden');
        isValid = false;
        return isValid;
      }
    }
  }

  if (!libIdSelect.value) {
    libIdError.textContent = '请选择一个阅览室。';
    libIdError.classList.remove('hidden');
    isValid = false;
  }

  if (!seatNumberInput.value.trim()) {
    seatNumberError.textContent = '座位号不能为空。';
    seatNumberError.classList.remove('hidden');
    isValid = false;
  }
  return isValid;
}

// 处理时间输入，特别是处理iOS设备上没有秒的问题
function processTimeInput(timeValue) {
  if (!timeValue) return '';

  // 检查是否为iOS设备
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

  // 检查时间格式
  const timeParts = timeValue.split(':');

  if (timeParts.length === 2) {
    // 只有时和分，没有秒（iOS设备常见）
    console.log("检测到iOS格式时间输入，自动补全秒数");
    return timeValue + ':00';
  } else if (timeParts.length === 3) {
    // 已经是完整格式，包含秒
    return timeValue;
  } else {
    // 异常格式，返回原值
    console.warn("时间格式异常:", timeValue);
    return timeValue;
  }
}

form.addEventListener('submit', async function (event) {
  event.preventDefault();
  if (!validateForm()) return;

  submitButton.disabled = true;
  submitButton.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>处理中...';
  formGeneralError.classList.add('hidden');

  // Show submission overlay
  document.getElementById('submission_overlay').style.display = 'flex';

  // Show spinner for library loading during form submission as well, if needed, though it might be confusing.
  // For now, only on initial load.
  if (libLoaderSpinner && libIdSelect.value === "") { // If lib not selected, maybe show spinner - better to handle in loadLibraries
    // libLoaderSpinner.style.display = 'inline-block'; 
  }

  const formData = new FormData(form);
  const data = {
    mode: parseInt(formData.get('mode')),
    cookieStr: formData.get('cookieStr'),
    timeStr: formData.get('timeStr').trim(),
    libId: parseInt(formData.get('libId')),
    seatNumber: formData.get('seatNumber'),
    clientId: generateClientId()
  };

  try {
    const response = await fetch(`${API_URL}/submit_request`, { // Corrected URL
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) { // Reverted to original error handling
      const errorData = await response.json().catch(() => ({ detail: '请求失败，无法解析错误信息。' }));
      throw new Error(errorData.detail || `HTTP error ${response.status}`);
    }

    // 请求已提交，但不立即标记为成功
    // 预约结果将在状态页中确认后再保存

    // 通知父页面请求已提交成功（用于导航控制）
    if (window.parent && typeof window.parent.notifySubmissionSuccess === 'function') {
      window.parent.notifySubmissionSuccess(data.clientId);
    }

  } catch (error) {
    console.error('Submission failed:', error);
    formGeneralError.textContent = `提交失败: ${error.message}`;
    formGeneralError.classList.remove('hidden');
  } finally {
    submitButton.disabled = false;
    submitButton.innerHTML = '<i class="fas fa-paper-plane mr-2"></i>提交请求';
    // Hide submission overlay
    document.getElementById('submission_overlay').style.display = 'none';
  }
});

// modeRadios.forEach(radio => radio.addEventListener('change', toggleTimeInput)); 

// Event listeners for new mode switch
modeTomorrowRadio.addEventListener('change', () => { updateModeSwitchVisuals(); saveFormDataToLocalStorage(); });
modeInstantRadio.addEventListener('change', () => { updateModeSwitchVisuals(); saveFormDataToLocalStorage(); });

// Event listeners for other inputs to save data
cookieStrInput.addEventListener('input', () => {
  saveFormDataToLocalStorage();
  autoResizeTextarea(cookieStrInput); // Auto-resize on input
});
//timeStrInput.addEventListener('input', saveFormDataToLocalStorage);
libIdSelect.addEventListener('change', saveFormDataToLocalStorage);
seatNumberInput.addEventListener('input', saveFormDataToLocalStorage);

// 执行时间选择器的事件监听
executionNowRadio.addEventListener('change', () => {
  updateExecutionTimeVisuals();
  saveFormDataToLocalStorage();
});

executionDefaultRadio.addEventListener('change', () => {
  updateExecutionTimeVisuals();
  saveFormDataToLocalStorage();
});

executionCustomRadio.addEventListener('change', () => {
  updateExecutionTimeVisuals();
  saveFormDataToLocalStorage();
});

// Function to set theme (called by parent)
window.setAppTheme = function (theme) {
  if (theme === 'dark') {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
};

// 更新查看结果按钮状态
function updateViewResultButtonState() {
  try {
    const reservationData = localStorage.getItem('lastReservationResult');
    const hasSuccessfulReservation = reservationData !== null &&
      JSON.parse(reservationData).isSuccess === true;

    viewResultButton.disabled = !hasSuccessfulReservation;

    if (hasSuccessfulReservation) {
      viewResultButton.title = "查看最近的预约结果";
    } else {
      viewResultButton.title = "暂无成功的预约结果";
    }
  } catch (e) {
    console.error("更新结果按钮状态出错:", e);
    viewResultButton.disabled = true;
    viewResultButton.title = "无法检索预约结果";
  }
}

// 测试函数 - 用于向localStorage添加测试数据
function addTestData() {
  const testData = {
    roomName: "测试阅览室",
    seatNumber: "测试座位号",
    timeInfo: new Date().toLocaleString('zh-CN'),
    timestamp: new Date().getTime(),
    isSuccess: true // 标记为成功的预约
  };
  localStorage.setItem('lastReservationResult', JSON.stringify(testData));
  console.log("测试数据已添加:", testData);
  updateViewResultButtonState();
}

// 显示成功卡片
function showSuccessCard(roomName, seatNumber, timeInfo) {
  console.log("显示成功卡片:", roomName, seatNumber, timeInfo);
  const successCard = document.getElementById('successCard');
  if (!successCard) {
    console.error("找不到成功卡片元素!");
    return;
  }

  const roomInfoEl = document.getElementById('roomInfo');
  const seatInfoEl = document.getElementById('seatInfo');
  const timeInfoEl = document.getElementById('reserveTime');
  const encouragementEl = document.getElementById('encouragementText');

  // 设置卡片内容
  if (roomInfoEl) roomInfoEl.textContent = roomName || '未知';
  if (seatInfoEl) seatInfoEl.textContent = seatNumber || '未知';
  if (timeInfoEl) timeInfoEl.textContent = timeInfo || new Date().toLocaleString('zh-CN');
  if (encouragementEl) encouragementEl.textContent = getRandomEncouragement();

  // 显示卡片
  console.log("添加show类显示卡片");
  successCard.classList.add('show');

  // 通过延时添加点击监听器，确保当前事件循环完成
  setTimeout(() => {
    // 添加点击背景关闭功能
    document.addEventListener('click', handleOutsideClick);

    // 添加ESC键关闭功能
    document.addEventListener('keydown', handleEscKey);
  }, 100);
}

// 处理卡片外部点击
function handleOutsideClick(e) {
  const successCard = document.getElementById('successCard');
  if (!successCard) return;

  // 检查点击是否在卡片外部且不是查看结果按钮
  const viewResultButton = document.getElementById('view_result_button');
  if (e.target !== successCard &&
    !successCard.contains(e.target) &&
    e.target !== viewResultButton &&
    !viewResultButton.contains(e.target)) {
    hideSuccessCard();
  }
}

// 处理ESC键关闭
function handleEscKey(e) {
  if (e.key === 'Escape') {
    hideSuccessCard();
  }
}

// 隐藏成功卡片
function hideSuccessCard() {
  console.log("隐藏成功卡片");
  const successCard = document.getElementById('successCard');
  if (successCard) {
    successCard.classList.remove('show');

    // 移除事件监听器
    document.removeEventListener('click', handleOutsideClick);
    document.removeEventListener('keydown', handleEscKey);
  }
}

// 显示预约结果卡片
function showReservationResults(e) {
  // 阻止事件冒泡
  if (e) e.stopPropagation();

  console.log("显示预约结果函数被调用");
  const reservationData = localStorage.getItem('lastReservationResult');
  if (!reservationData) {
    console.log("没有找到预约结果数据");
    alert("暂无预约结果，请先成功预约座位。");
    return;
  }

  try {
    console.log("尝试解析预约数据:", reservationData);
    const data = JSON.parse(reservationData);
    // 检查是否是成功的预约
    if (data.isSuccess === true) {
      showSuccessCard(data.roomName, data.seatNumber, data.timeInfo);
    } else {
      alert("没有成功的预约记录。");
    }
  } catch (e) {
    console.error('Error loading reservation result:', e);
    alert('无法加载预约结果。');
  }
}

// 保存预约结果到本地存储
function saveReservationResult(roomName, seatNumber, timeInfo) {
  const reservationData = {
    roomName: roomName,
    seatNumber: seatNumber,
    timeInfo: timeInfo || new Date().toLocaleString('zh-CN'),
    timestamp: new Date().getTime(),
    isSuccess: true // 标记为成功的预约
  };
  localStorage.setItem('lastReservationResult', JSON.stringify(reservationData));
  updateViewResultButtonState();
}

// 随机鼓励语句数组
const encouragements = [
  "今天也要加油学习哦！✨",
  "知识就是力量，继续前进吧！💪",
  "一步一个脚印，你正在变得更强！🌟",
  "保持专注，你一定能实现目标！🎯",
  "每一天的努力都在为未来铺路！🌈",
  "静心学习，收获知识的果实！📚",
  "今天的付出，是明天的收获！🌱",
  "保持热爱，奔赴山海！⛰️",
  "学习使人进步，加油！💡",
  "愿你的努力都能开花结果！🌸",
  "书山有路勤为径，学海无涯苦作舟！🚀",
  "每一次专注都是对未来的投资！💫",
  "让知识成为你最闪亮的光芒！⭐",
  "坚持的人最美丽，奋斗的人最可爱！🌺"
];

// 获取随机鼓励语
function getRandomEncouragement() {
  return encouragements[Math.floor(Math.random() * encouragements.length)];
}