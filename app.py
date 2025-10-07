#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
WeiboChat Insight Dashboard - Flask Backend
Provides API endpoints for dashboard data visualization
"""

import json
import os
import pickle
from collections import Counter, defaultdict
from datetime import datetime, timedelta
from pathlib import Path

import pandas as pd
from flask import Flask, jsonify, render_template, request

app = Flask(__name__)

# Configuration
DATA_DIR = Path("data/processed")
CACHE_DIR = Path("cache")
CACHE_DIR.mkdir(exist_ok=True)

# Global data storage
data_cache = {}
selected_files = []  # Track selected files for analysis

def get_available_files():
    """Get list of available NDJSON files"""
    return [f.name for f in DATA_DIR.glob("*.ndjson")]

def load_data(file_names=None):
    """Load and cache processed data from NDJSON files"""
    global data_cache, selected_files
    
    # If no specific files provided, use all available files
    if not file_names:
        ndjson_files = list(DATA_DIR.glob("*.ndjson"))
    else:
        ndjson_files = [DATA_DIR / f for f in file_names if (DATA_DIR / f).exists()]
    
    if not ndjson_files:
        raise FileNotFoundError(f"No NDJSON files found in {DATA_DIR}")
    
    selected_files = [f.name for f in ndjson_files]
    
    # Load data from selected files
    all_data = []
    for file_path in ndjson_files:
        with open(file_path, 'r', encoding='utf-8') as f:
            for line in f:
                if line.strip():
                    all_data.append(json.loads(line))
    
    # Convert to DataFrame
    df = pd.DataFrame(all_data)
    
    # Convert time to datetime (Beijing timezone UTC+8)
    df['datetime'] = pd.to_datetime(df['time'], unit='s').dt.tz_localize('UTC').dt.tz_convert('Asia/Shanghai')
    df['date'] = df['datetime'].dt.date
    df['hour'] = df['datetime'].dt.hour
    df['weekday'] = df['datetime'].dt.dayofweek  # 0=Monday, 6=Sunday
    
    data_cache['df'] = df
    data_cache['selected_files'] = selected_files
    print(f"Loaded {len(df)} messages from {len(ndjson_files)} files: {selected_files}")

def get_cache_key(endpoint, file_suffix=""):
    """Generate cache key for API endpoint"""
    if file_suffix:
        return CACHE_DIR / f"{endpoint}_{file_suffix}.pkl"
    return CACHE_DIR / f"{endpoint}.pkl"

def get_or_compute_cache(endpoint, compute_func, file_suffix=""):
    """Get cached data or compute and cache it"""
    cache_key = get_cache_key(endpoint, file_suffix)
    
    if cache_key.exists():
        with open(cache_key, 'rb') as f:
            return pickle.load(f)
    
    result = compute_func()
    with open(cache_key, 'wb') as f:
        pickle.dump(result, f)
    
    return result

def clear_cache():
    """Clear all cached data"""
    for cache_file in CACHE_DIR.glob("*.pkl"):
        cache_file.unlink()
    print("Cache cleared")

@app.route('/')
def index():
    """Render dashboard page"""
    return render_template('index.html')

@app.route('/api/files')
def api_files():
    """Return available NDJSON files and currently selected files"""
    available_files = get_available_files()
    current_selection = data_cache.get('selected_files', [])
    
    return jsonify({
        'available': available_files,
        'selected': current_selection
    })

@app.route('/api/select_files', methods=['POST'])
def api_select_files():
    """Select specific files for analysis"""
    try:
        data = request.get_json()
        selected_file_names = data.get('files', [])
        
        if not selected_file_names:
            return jsonify({'error': 'No files selected'}), 400
        
        # Validate that files exist
        available_files = get_available_files()
        invalid_files = [f for f in selected_file_names if f not in available_files]
        if invalid_files:
            return jsonify({'error': f'Invalid files: {invalid_files}'}), 400
        
        # Clear existing cache when switching files
        clear_cache()
        
        # Load data from selected files
        load_data(selected_file_names)
        
        return jsonify({
            'success': True,
            'selected_files': selected_file_names,
            'message_count': len(data_cache['df'])
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/summary')
def api_summary():
    """Return overall statistics"""
    def compute():
        df = data_cache['df']
        total_messages = len(df)
        total_users = df['from_uid'].nunique()
        total_redpacket_amount = df[df['is_redpacket']]['redpacket_amount'].sum()
        avg_token_length = df[df['is_text']]['token_count'].mean()
        avg_content_length = df[df['is_text']]['content_len'].mean()
        
        return {
            'total_messages': int(total_messages),
            'total_users': int(total_users),
            'total_redpacket_amount': float(total_redpacket_amount or 0),
            'avg_token_length': round(float(avg_token_length or 0), 2),
            'avg_content_length': round(float(avg_content_length or 0), 2)
        }
    
    file_suffix = "_".join(selected_files) if selected_files else "all"
    return jsonify(get_or_compute_cache('summary', compute, file_suffix))

@app.route('/api/daily')
def api_daily():
    """Return daily trend data"""
    def compute():
        df = data_cache['df']
        daily_stats = df.groupby('date').agg({
            'id': 'count',
            'redpacket_amount': 'sum'
        }).rename(columns={'id': 'message_count'}).reset_index()
        
        daily_stats['date'] = daily_stats['date'].astype(str)
        return daily_stats.to_dict('records')
    
    file_suffix = "_".join(selected_files) if selected_files else "all"
    return jsonify(get_or_compute_cache('daily', compute, file_suffix))

@app.route('/api/hourly_heatmap')
def api_hourly_heatmap():
    """Return weekly hourly heatmap data"""
    def compute():
        df = data_cache['df']
        heatmap_data = df.groupby(['weekday', 'hour']).size().reset_index(name='count')
        
        # Convert to format suitable for ECharts heatmap
        data = []
        for _, row in heatmap_data.iterrows():
            data.append([int(row['hour']), int(row['weekday']), int(row['count'])])
        
        return data
    
    file_suffix = "_".join(selected_files) if selected_files else "all"
    return jsonify(get_or_compute_cache('hourly_heatmap', compute, file_suffix))

@app.route('/api/top_users')
def api_top_users():
    """Return top users by message count"""
    def compute():
        df = data_cache['df']
        top_users = df.groupby(['from_uid', 'screen_name']).size().reset_index(name='message_count')
        top_users = top_users.sort_values('message_count', ascending=False).head(20)
        
        return top_users.to_dict('records')
    
    file_suffix = "_".join(selected_files) if selected_files else "all"
    return jsonify(get_or_compute_cache('top_users', compute, file_suffix))

@app.route('/api/message_types')
def api_message_types():
    """Return message type distribution"""
    def compute():
        df = data_cache['df']
        
        type_counts = {
            'text': int(df['is_text'].sum()),
            'image': int(df['is_image'].sum()),
            'redpacket': int(df['is_redpacket'].sum())
        }
        
        total = sum(type_counts.values())
        type_percentages = {
            k: round(v / total * 100, 2) if total > 0 else 0 
            for k, v in type_counts.items()
        }
        
        return {
            'counts': type_counts,
            'percentages': type_percentages
        }
    
    file_suffix = "_".join(selected_files) if selected_files else "all"
    return jsonify(get_or_compute_cache('message_types', compute, file_suffix))

@app.route('/api/token_histogram')
def api_token_histogram():
    """Return token length distribution with both content_len and token_count"""
    def compute():
        df = data_cache['df']
        text_messages = df[df['is_text']]
        
        if len(text_messages) == 0:
            return {'content_len': [], 'token_count': []}
        
        # Content length histogram
        content_lengths = text_messages['content_len'].values
        content_bins = list(range(0, int(max(content_lengths)) + 10, 10))
        content_hist, _ = pd.cut(content_lengths, bins=content_bins, right=False, retbins=True)
        content_hist_counts = content_hist.value_counts().sort_index()
        
        content_result = []
        for interval, count in content_hist_counts.items():
            content_result.append({
                'range': str(interval),
                'count': int(count),
                'min': int(interval.left),
                'max': int(interval.right)
            })
        
        # Token count histogram
        token_messages = text_messages[text_messages['token_count'].notna()]
        if len(token_messages) > 0:
            token_counts = token_messages['token_count'].values
            token_bins = list(range(0, int(max(token_counts)) + 10, 10))
            token_hist, _ = pd.cut(token_counts, bins=token_bins, right=False, retbins=True)
            token_hist_counts = token_hist.value_counts().sort_index()
            
            token_result = []
            for interval, count in token_hist_counts.items():
                token_result.append({
                    'range': str(interval),
                    'count': int(count),
                    'min': int(interval.left),
                    'max': int(interval.right)
                })
        else:
            token_result = []
        
        return {
            'content_len': content_result,
            'token_count': token_result
        }
    
    file_suffix = "_".join(selected_files) if selected_files else "all"
    return jsonify(get_or_compute_cache('token_histogram', compute, file_suffix))

@app.route('/api/redpackets')
def api_redpackets():
    """Return redpacket statistics over time (filtering out amounts > 50)"""
    def compute():
        df = data_cache['df']
        redpacket_data = df[df['is_redpacket']].copy()
        
        # Filter out redpacket amounts greater than 50
        redpacket_data = redpacket_data[redpacket_data['redpacket_amount'] <= 50]
        
        if len(redpacket_data) == 0:
            return {'scatter': [], 'cumulative': []}
        
        # Group by date
        daily_redpackets = redpacket_data.groupby('date').agg({
            'redpacket_amount': 'sum'
        }).reset_index()
        
        daily_redpackets['date'] = daily_redpackets['date'].astype(str)
        
        # Create scatter data points
        scatter_data = []
        for _, row in redpacket_data.iterrows():
            scatter_data.append([
                str(row['date']),
                float(row['redpacket_amount'] or 0)
            ])
        
        # Create cumulative data
        cumulative_data = []
        cumulative_amount = 0
        for _, row in daily_redpackets.iterrows():
            cumulative_amount += float(row['redpacket_amount'] or 0)
            cumulative_data.append({
                'date': row['date'],
                'cumulative_amount': cumulative_amount
            })
        
        return {
            'scatter': scatter_data,
            'cumulative': cumulative_data
        }
    
    file_suffix = "_".join(selected_files) if selected_files else "all"
    return jsonify(get_or_compute_cache('redpackets', compute, file_suffix))

@app.route('/api/source_ratio')
def api_source_ratio():
    """Return Web vs Mobile usage ratio over time"""
    def compute():
        df = data_cache['df']
        
        # Group by date and source type
        daily_source = df.groupby(['date', 'is_web']).size().unstack(fill_value=0)
        daily_source.columns = ['mobile', 'web']  # False=mobile, True=web
        daily_source = daily_source.reset_index()
        
        # Calculate ratios
        daily_source['total'] = daily_source['mobile'] + daily_source['web']
        daily_source['web_ratio'] = daily_source.apply(
            lambda x: x['web'] / x['total'] if x['total'] > 0 else 0, axis=1
        )
        daily_source['mobile_ratio'] = daily_source.apply(
            lambda x: x['mobile'] / x['total'] if x['total'] > 0 else 0, axis=1
        )
        
        daily_source['date'] = daily_source['date'].astype(str)
        
        return daily_source.to_dict('records')
    
    file_suffix = "_".join(selected_files) if selected_files else "all"
    return jsonify(get_or_compute_cache('source_ratio', compute, file_suffix))

@app.route('/api/user_trend/<user_id>')
def api_user_trend(user_id):
    """Return individual user trend data"""
    def compute():
        df = data_cache['df']
        user_data = df[df['from_uid'] == user_id]
        
        if len(user_data) == 0:
            return []
        
        # Group by date
        user_daily = user_data.groupby('date').size().reset_index(name='message_count')
        user_daily['date'] = user_daily['date'].astype(str)
        
        return user_daily.to_dict('records')
    
    file_suffix = "_".join(selected_files) if selected_files else "all"
    return jsonify(get_or_compute_cache(f'user_trend_{user_id}', compute, file_suffix))

if __name__ == '__main__':
    print("Loading data...")
    load_data()
    print("Starting Flask server...")
    app.run(debug=True, host='0.0.0.0', port=2233)
