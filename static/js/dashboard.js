/**
 * WeiboChat Insight Dashboard - JavaScript
 * Handles data fetching, chart rendering, and interactions
 */

// Global variables
let charts = {};
let userTrendChart = null;
let availableFiles = [];
let selectedFiles = [];

// Initialize dashboard
document.addEventListener('DOMContentLoaded', function() {
    console.log('Initializing WeiboChat Insight Dashboard...');
    
    // Initialize charts
    initCharts();
    
    // Load available files first
    loadAvailableFiles();
    
    // Setup event listeners
    setupEventListeners();
});

// Initialize all ECharts instances
function initCharts() {
    // Daily trend chart
    charts.dailyTrend = echarts.init(document.getElementById('daily-trend-chart'));
    
    // Hourly heatmap
    charts.hourlyHeatmap = echarts.init(document.getElementById('hourly-heatmap-chart'));
    
    // Top users chart
    charts.topUsers = echarts.init(document.getElementById('top-users-chart'));
    
    // Message types chart
    charts.messageTypes = echarts.init(document.getElementById('message-types-chart'));
    
    // Source ratio chart
    charts.sourceRatio = echarts.init(document.getElementById('source-ratio-chart'));
    
    // Token histogram chart
    charts.tokenHistogram = echarts.init(document.getElementById('token-histogram-chart'));
    
    // Redpacket chart
    charts.redpacket = echarts.init(document.getElementById('redpacket-chart'));
    
    // User trend modal chart
    userTrendChart = echarts.init(document.getElementById('user-trend-chart'));
    
    // Handle window resize
    window.addEventListener('resize', function() {
        Object.values(charts).forEach(chart => {
            if (chart) chart.resize();
        });
        if (userTrendChart) userTrendChart.resize();
    });
}

// Setup event listeners
function setupEventListeners() {
    // Download button
    document.getElementById('downloadBtn').addEventListener('click', downloadDashboard);
    
    // Close modal button
    document.getElementById('close-modal').addEventListener('click', closeUserTrendModal);
    
    // Click outside modal to close
    document.getElementById('user-trend-modal').addEventListener('click', function(e) {
        if (e.target === this) {
            closeUserTrendModal();
        }
    });
    
    // File selection buttons
    document.getElementById('selectAllBtn').addEventListener('click', selectAllFiles);
    document.getElementById('deselectAllBtn').addEventListener('click', deselectAllFiles);
    document.getElementById('applySelectionBtn').addEventListener('click', applyFileSelection);
}

// Load available files
async function loadAvailableFiles() {
    try {
        const response = await fetch('/api/files');
        const data = await response.json();
        
        availableFiles = data.available;
        selectedFiles = data.selected;
        
        renderFileSelection();
        
        // Load dashboard data after files are loaded
        if (selectedFiles.length > 0) {
            loadAllData();
        } else {
            // If no files selected, select all by default
            selectedFiles = [...availableFiles];
            renderFileSelection();
            loadAllData();
        }
        
    } catch (error) {
        console.error('Error loading available files:', error);
        showError('加载文件列表失败');
    }
}

// Render file selection UI
function renderFileSelection() {
    const container = document.getElementById('file-selection-container');
    container.innerHTML = '';
    
    availableFiles.forEach(file => {
        const isSelected = selectedFiles.includes(file);
        const checkbox = document.createElement('label');
        checkbox.className = 'flex items-center gap-2 cursor-pointer px-3 py-2 rounded border hover:bg-gray-50 transition-colors';
        checkbox.innerHTML = `
            <input type="checkbox" class="file-checkbox" value="${file}" ${isSelected ? 'checked' : ''}>
            <span class="text-sm text-gray-700">${file}</span>
        `;
        container.appendChild(checkbox);
    });
    
    updateFileSelectionStatus();
}

// Update file selection status
function updateFileSelectionStatus() {
    const statusDiv = document.getElementById('file-selection-status');
    const selectedCount = selectedFiles.length;
    const totalCount = availableFiles.length;
    
    if (selectedCount === 0) {
        statusDiv.innerHTML = '<span class="text-red-600">请至少选择一个文件</span>';
    } else if (selectedCount === totalCount) {
        statusDiv.innerHTML = `<span class="text-green-600">已选择全部 ${totalCount} 个文件</span>`;
    } else {
        statusDiv.innerHTML = `<span class="text-blue-600">已选择 ${selectedCount} / ${totalCount} 个文件</span>`;
    }
}

// Select all files
function selectAllFiles() {
    selectedFiles = [...availableFiles];
    renderFileSelection();
}

// Deselect all files
function deselectAllFiles() {
    selectedFiles = [];
    renderFileSelection();
}

// Apply file selection
async function applyFileSelection() {
    const checkboxes = document.querySelectorAll('.file-checkbox:checked');
    const selectedFileNames = Array.from(checkboxes).map(cb => cb.value);
    
    if (selectedFileNames.length === 0) {
        showError('请至少选择一个文件');
        return;
    }
    
    try {
        const applyBtn = document.getElementById('applySelectionBtn');
        applyBtn.disabled = true;
        applyBtn.innerHTML = '<span class="spinner"></span> 应用中...';
        
        const response = await fetch('/api/select_files', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ files: selectedFileNames })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            selectedFiles = selectedFileNames;
            showSuccess(`成功加载 ${data.message_count} 条消息`);
            loadAllData(); // Reload all dashboard data
        } else {
            showError(data.error || '应用文件选择失败');
        }
        
        applyBtn.disabled = false;
        applyBtn.innerHTML = '应用选择';
        
    } catch (error) {
        console.error('Error applying file selection:', error);
        showError('应用文件选择失败');
        
        const applyBtn = document.getElementById('applySelectionBtn');
        applyBtn.disabled = false;
        applyBtn.innerHTML = '应用选择';
    }
}

// Load all data from APIs
async function loadAllData() {
    try {
        // Load summary data first
        const summaryResponse = await fetch('/api/summary');
        const summaryData = await summaryResponse.json();
        updateSummaryCards(summaryData);
        
        // Load all other data in parallel
        const [
            dailyData,
            hourlyData,
            topUsersData,
            messageTypesData,
            sourceRatioData,
            tokenHistogramData,
            redpacketData
        ] = await Promise.all([
            fetch('/api/daily').then(r => r.json()),
            fetch('/api/hourly_heatmap').then(r => r.json()),
            fetch('/api/top_users').then(r => r.json()),
            fetch('/api/message_types').then(r => r.json()),
            fetch('/api/source_ratio').then(r => r.json()),
            fetch('/api/token_histogram').then(r => r.json()),
            fetch('/api/redpackets').then(r => r.json())
        ]);
        
        // Update charts
        updateDailyTrendChart(dailyData);
        updateHourlyHeatmap(hourlyData);
        updateTopUsersChart(topUsersData);
        updateMessageTypesChart(messageTypesData);
        updateSourceRatioChart(sourceRatioData);
        updateTokenHistogramChart(tokenHistogramData);
        updateRedpacketChart(redpacketData);
        updateMessageTypesTable(messageTypesData);
        updateMessageTypesProportionBar(messageTypesData);
        
    } catch (error) {
        console.error('Error loading data:', error);
        showError('加载数据失败，请刷新页面重试');
    }
}

// Update summary cards
function updateSummaryCards(data) {
    document.getElementById('total-messages').textContent = data.total_messages.toLocaleString();
    document.getElementById('total-users').textContent = data.total_users.toLocaleString();
    document.getElementById('total-redpacket').textContent = `¥${data.total_redpacket_amount.toFixed(2)}`;
    document.getElementById('avg-content-length').textContent = data.avg_content_length.toFixed(1);
    document.getElementById('avg-token-length').textContent = data.avg_token_length.toFixed(1);
}

// Update daily trend chart
function updateDailyTrendChart(data) {
    const option = {
        title: {
            text: '消息数量与红包金额趋势',
            left: 'center'
        },
        tooltip: {
            trigger: 'axis',
            axisPointer: {
                type: 'cross'
            }
        },
        legend: {
            data: ['消息数量', '红包金额'],
            bottom: 0
        },
        grid: {
            left: '3%',
            right: '4%',
            bottom: '15%',
            containLabel: true
        },
        xAxis: {
            type: 'category',
            data: data.map(d => d.date),
            axisLabel: {
                rotate: 45
            }
        },
        yAxis: [
            {
                type: 'value',
                name: '消息数量',
                position: 'left'
            },
            {
                type: 'value',
                name: '红包金额 (¥)',
                position: 'right'
            }
        ],
        dataZoom: [
            {
                type: 'inside',
                start: 0,
                end: 100
            },
            {
                start: 0,
                end: 100
            }
        ],
        series: [
            {
                name: '消息数量',
                type: 'line',
                data: data.map(d => d.message_count),
                smooth: true,
                itemStyle: {
                    color: '#3b82f6'
                }
            },
            {
                name: '红包金额',
                type: 'line',
                yAxisIndex: 1,
                data: data.map(d => d.redpacket_amount),
                smooth: true,
                areaStyle: {
                    opacity: 0.3
                },
                itemStyle: {
                    color: '#ef4444'
                }
            }
        ]
    };
    
    charts.dailyTrend.setOption(option);
}

// Update hourly heatmap
function updateHourlyHeatmap(data) {
    const hours = Array.from({length: 24}, (_, i) => i);
    const weekdays = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
    
    const option = {
        title: {
            text: '消息活跃度热力图',
            left: 'center'
        },
        tooltip: {
            position: 'top'
        },
        grid: {
            height: '70%',
            top: '10%'
        },
        xAxis: {
            type: 'category',
            data: hours,
            splitArea: {
                show: true
            },
            axisLabel: {
                formatter: '{value}时'
            }
        },
        yAxis: {
            type: 'category',
            data: weekdays,
            splitArea: {
                show: true
            }
        },
        visualMap: {
            min: 0,
            max: Math.max(...data.map(d => d[2])),
            calculable: true,
            orient: 'horizontal',
            left: 'center',
            bottom: '5%',
            inRange: {
                color: ['#e0e7ff', '#c7d2fe', '#a5b4fc', '#818cf8', '#6366f1']
            }
        },
        series: [{
            name: '消息数量',
            type: 'heatmap',
            data: data,
            label: {
                show: false
            },
            emphasis: {
                itemStyle: {
                    shadowBlur: 10,
                    shadowColor: 'rgba(0, 0, 0, 0.5)'
                }
            }
        }]
    };
    
    charts.hourlyHeatmap.setOption(option);
}

// Update top users chart
function updateTopUsersChart(data) {
    const option = {
        title: {
            text: '发言最多的用户',
            left: 'center'
        },
        tooltip: {
            trigger: 'axis',
            axisPointer: {
                type: 'shadow'
            }
        },
        grid: {
            left: '3%',
            right: '4%',
            bottom: '3%',
            containLabel: true
        },
        xAxis: {
            type: 'value',
            name: '消息数量'
        },
        yAxis: {
            type: 'category',
            data: data.slice(0, 20).map(d => d.screen_name || d.from_uid).reverse(),
            axisLabel: {
                formatter: function(value) {
                    return value; // Don't truncate usernames
                }
            }
        },
        series: [{
            name: '消息数量',
            type: 'bar',
            data: data.slice(0, 20).map(d => d.message_count).reverse(),
            itemStyle: {
                color: '#10b981'
            }
        }]
    };
    
    charts.topUsers.setOption(option);
    
    // Add click event to show user trend
    charts.topUsers.off('click');
    charts.topUsers.on('click', function(params) {
        const userData = data[params.dataIndex];
        showUserTrend(userData.from_uid, userData.screen_name);
    });
}

// Update message types chart
function updateMessageTypesChart(data) {
    const option = {
        title: {
            text: '消息类型占比',
            left: 'center'
        },
        tooltip: {
            trigger: 'item',
            formatter: '{a} <br/>{b}: {c} ({d}%)'
        },
        legend: {
            orient: 'vertical',
            left: 'left',
            data: ['文本', '图片', '红包感谢']
        },
        series: [{
            name: '消息类型',
            type: 'pie',
            radius: '50%',
            data: [
                {value: data.counts.text, name: `文本 (${data.percentages.text}%)`},
                {value: data.counts.image, name: `图片 (${data.percentages.image}%)`},
                {value: data.counts.redpacket, name: `红包感谢 (${data.percentages.redpacket}%)`}
            ],
            emphasis: {
                itemStyle: {
                    shadowBlur: 10,
                    shadowOffsetX: 0,
                    shadowColor: 'rgba(0, 0, 0, 0.5)'
                }
            },
            itemStyle: {
                color: function(params) {
                    const colors = ['#3b82f6', '#10b981', '#f59e0b'];
                    return colors[params.dataIndex];
                }
            },
            label: {
                formatter: '{b}'
            }
        }]
    };
    
    charts.messageTypes.setOption(option);
}

// Update message types proportion bar
function updateMessageTypesProportionBar(data) {
    const total = data.counts.text + data.counts.image + data.counts.redpacket;
    const textPercent = (data.counts.text / total * 100).toFixed(1);
    const imagePercent = (data.counts.image / total * 100).toFixed(1);
    const redpacketPercent = (data.counts.redpacket / total * 100).toFixed(1);
    
    const textBar = document.getElementById('text-proportion-bar');
    const imageBar = document.getElementById('image-proportion-bar');
    const redpacketBar = document.getElementById('redpacket-proportion-bar');
    
    textBar.style.width = textPercent + '%';
    textBar.textContent = textPercent > 10 ? `${textPercent}%` : '';
    
    imageBar.style.width = imagePercent + '%';
    imageBar.textContent = imagePercent > 10 ? `${imagePercent}%` : '';
    
    redpacketBar.style.width = redpacketPercent + '%';
    redpacketBar.textContent = redpacketPercent > 10 ? `${redpacketPercent}%` : '';
}

// Update source ratio chart
function updateSourceRatioChart(data) {
    const option = {
        title: {
            text: 'Web vs Mobile 使用占比',
            left: 'center'
        },
        tooltip: {
            trigger: 'axis',
            axisPointer: {
                type: 'cross'
            }
        },
        legend: {
            data: ['Web占比', 'Mobile占比'],
            bottom: 0
        },
        grid: {
            left: '3%',
            right: '4%',
            bottom: '15%',
            containLabel: true
        },
        xAxis: {
            type: 'category',
            data: data.map(d => d.date),
            axisLabel: {
                rotate: 45
            }
        },
        yAxis: {
            type: 'value',
            name: '占比 (%)',
            max: 100
        },
        series: [
            {
                name: 'Web占比',
                type: 'line',
                stack: '总量',
                areaStyle: {},
                data: data.map(d => (d.web_ratio * 100).toFixed(1)),
                itemStyle: {
                    color: '#8b5cf6'
                }
            },
            {
                name: 'Mobile占比',
                type: 'line',
                stack: '总量',
                areaStyle: {},
                data: data.map(d => (d.mobile_ratio * 100).toFixed(1)),
                itemStyle: {
                    color: '#06b6d4'
                }
            }
        ]
    };
    
    charts.sourceRatio.setOption(option);
}

// Update token histogram chart
function updateTokenHistogramChart(data) {
    const contentData = data.content_len;
    const tokenData = data.token_count;
    
    // Find common ranges for both datasets
    const maxRange = Math.max(
        contentData.length > 0 ? Math.max(...contentData.map(d => d.max)) : 0,
        tokenData.length > 0 ? Math.max(...tokenData.map(d => d.max)) : 0
    );
    
    // Create adaptive bins
    const binSize = maxRange > 200 ? 20 : 10;
    const bins = listRange(0, maxRange + binSize, binSize);
    
    const option = {
        title: {
            text: '消息长度分布',
            left: 'center'
        },
        tooltip: {
            trigger: 'axis',
            axisPointer: {
                type: 'shadow'
            }
        },
        legend: {
            data: ['字符长度', 'Token数量'],
            bottom: 0
        },
        grid: {
            left: '3%',
            right: '4%',
            bottom: '15%',
            containLabel: true
        },
        xAxis: {
            type: 'category',
            data: bins.slice(0, -1).map((bin, i) => `${bin}-${bins[i+1]}`),
            name: '长度区间'
        },
        yAxis: {
            type: 'value',
            name: '消息数量'
        },
        series: [
            {
                name: '字符长度',
                type: 'bar',
                data: contentData.map(d => d.count),
                itemStyle: {
                    color: '#3b82f6'
                }
            },
            {
                name: 'Token数量',
                type: 'bar',
                data: tokenData.map(d => d.count),
                itemStyle: {
                    color: '#10b981'
                }
            }
        ]
    };
    
    charts.tokenHistogram.setOption(option);
}

// Helper function to create range
function listRange(start, end, step) {
    const result = [];
    for (let i = start; i < end; i += step) {
        result.push(i);
    }
    return result;
}

// Update redpacket chart
function updateRedpacketChart(data) {
    const option = {
        title: {
            text: '红包统计',
            left: 'center'
        },
        tooltip: {
            trigger: 'axis',
            axisPointer: {
                type: 'cross'
            }
        },
        legend: {
            data: ['红包金额', '累计金额'],
            bottom: 0
        },
        grid: {
            left: '3%',
            right: '4%',
            bottom: '15%',
            containLabel: true
        },
        xAxis: {
            type: 'category',
            data: data.scatter.map(d => d[0]),
            axisLabel: {
                rotate: 45
            }
        },
        yAxis: [
            {
                type: 'value',
                name: '红包金额 (¥)',
                position: 'left'
            },
            {
                type: 'value',
                name: '累计金额 (¥)',
                position: 'right'
            }
        ],
        series: [
            {
                name: '红包金额',
                type: 'scatter',
                data: data.scatter.map(d => d[1]),
                symbolSize: 8,
                itemStyle: {
                    color: '#ef4444'
                }
            },
            {
                name: '累计金额',
                type: 'line',
                yAxisIndex: 1,
                data: data.cumulative.map(d => d.cumulative_amount),
                smooth: true,
                itemStyle: {
                    color: '#dc2626'
                }
            }
        ]
    };
    
    charts.redpacket.setOption(option);
}

// Update message types table
function updateMessageTypesTable(data) {
    const tbody = document.getElementById('message-types-tbody');
    const examples = {
        'text': '这是一条测试消息',
        'image': '[图片消息]',
        'redpacket': '0.52元，@用户名'
    };
    
    tbody.innerHTML = '';
    
    Object.entries(data.counts).forEach(([type, count]) => {
        const row = document.createElement('tr');
        const typeNames = {
            'text': '文本',
            'image': '图片',
            'redpacket': '红包感谢'
        };
        
        row.innerHTML = `
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${typeNames[type]}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${count.toLocaleString()}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${data.percentages[type]}%</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${examples[type]}</td>
        `;
        
        tbody.appendChild(row);
    });
}

// Show user trend modal
async function showUserTrend(userId, userName) {
    try {
        const response = await fetch(`/api/user_trend/${userId}`);
        const data = await response.json();
        
        document.getElementById('user-trend-title').textContent = `${userName} 的发送趋势`;
        document.getElementById('user-trend-modal').classList.remove('hidden');
        document.getElementById('user-trend-modal').classList.add('flex');
        
        const option = {
            title: {
                text: `${userName} 的发送趋势`,
                left: 'center'
            },
            tooltip: {
                trigger: 'axis'
            },
            grid: {
                left: '3%',
                right: '4%',
                bottom: '3%',
                containLabel: true
            },
            xAxis: {
                type: 'category',
                data: data.map(d => d.date),
                axisLabel: {
                    rotate: 45
                }
            },
            yAxis: {
                type: 'value',
                name: '消息数量'
            },
            series: [{
                name: '消息数量',
                type: 'line',
                data: data.map(d => d.message_count),
                smooth: true,
                itemStyle: {
                    color: '#3b82f6'
                }
            }]
        };
        
        userTrendChart.setOption(option);
        userTrendChart.resize();
        
    } catch (error) {
        console.error('Error loading user trend:', error);
        showError('加载用户趋势失败');
    }
}

// Close user trend modal
function closeUserTrendModal() {
    document.getElementById('user-trend-modal').classList.add('hidden');
    document.getElementById('user-trend-modal').classList.remove('flex');
}

// Download dashboard screenshot
async function downloadDashboard() {
    try {
        const button = document.getElementById('downloadBtn');
        button.disabled = true;
        button.innerHTML = '<span>⏳</span><span>生成中...</span>';
        
        const el = document.querySelector('#dashboard');
        const result = await snapdom(el);
        await result.download({ 
            format: 'jpg', 
            filename: `weibochat_dashboard_${new Date().toISOString().slice(0, 10)}` 
        });
        
        button.disabled = false;
        button.innerHTML = '<span>📸</span><span>下载快照</span>';
        
    } catch (error) {
        console.error('Error downloading dashboard:', error);
        showError('下载失败，请重试');
        
        const button = document.getElementById('downloadBtn');
        button.disabled = false;
        button.innerHTML = '<span>📸</span><span>下载快照</span>';
    }
}

// Show error message
function showError(message) {
    // Create a simple error notification
    const errorDiv = document.createElement('div');
    errorDiv.className = 'fixed top-4 right-4 bg-red-500 text-white px-6 py-3 rounded-lg shadow-lg z-50';
    errorDiv.textContent = message;
    
    document.body.appendChild(errorDiv);
    
    setTimeout(() => {
        errorDiv.remove();
    }, 3000);
}

// Show success message
function showSuccess(message) {
    // Create a simple success notification
    const successDiv = document.createElement('div');
    successDiv.className = 'fixed top-4 right-4 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg z-50';
    successDiv.textContent = message;
    
    document.body.appendChild(successDiv);
    
    setTimeout(() => {
        successDiv.remove();
    }, 3000);
}
