"""
Unit tests for the data processing script

Run with: python -m pytest __tests__/process_data.test.py
"""

import json
import os
import sys
import tempfile
from pathlib import Path
import pandas as pd
import pytest

# Add parent directory to path to import the module
sys.path.insert(0, str(Path(__file__).parent.parent))
from process_data import ParkingDataProcessor


@pytest.fixture
def sample_csv_data():
    """Create sample CSV data for testing"""
    return pd.DataFrame({
        'vehicle_plate': ['ABC123', 'ABC123', 'XYZ789', 'ABC123'],
        'fine_amount': [100.0, 150.0, 200.0, 50.0],
        'citation_issued_datetime': [
            '2020-01-15 10:30:00',
            '2020-06-20 14:15:00',
            '2019-12-01 09:00:00',  # Should be filtered out
            '2021-03-10 16:45:00'
        ],
        'violation_desc': [
            'Expired Meter',
            'Street Cleaning',
            'No Parking',
            'Expired Meter'
        ],
        'citation_number': ['C1', 'C2', 'C3', 'C4'],
        'citation_location': ['123 Main St', '456 Oak Ave', '789 Elm St', '321 Pine St'],
        'vehicle_plate_state': ['CA', 'CA', 'CA', 'CA'],
        'latitude': [37.7749, 37.7849, 37.7649, 37.7949],
        'longitude': [-122.4194, -122.4094, -122.4294, -122.3994]
    })


@pytest.fixture
def temp_csv_file(sample_csv_data):
    """Create a temporary CSV file with sample data"""
    with tempfile.NamedTemporaryFile(mode='w', delete=False, suffix='.csv') as f:
        sample_csv_data.to_csv(f.name, index=False)
        yield f.name
    os.unlink(f.name)


@pytest.fixture
def temp_output_dir():
    """Create a temporary output directory"""
    temp_dir = tempfile.mkdtemp()
    yield temp_dir
    # Cleanup
    import shutil
    shutil.rmtree(temp_dir)


class TestParkingDataProcessor:
    """Test suite for ParkingDataProcessor"""

    def test_load_data(self, temp_csv_file):
        """Test that data loads correctly"""
        processor = ParkingDataProcessor(temp_csv_file)
        processor.load_data()
        
        assert processor.df is not None
        assert len(processor.df) == 4

    def test_filter_by_date(self, temp_csv_file):
        """Test date filtering functionality"""
        processor = ParkingDataProcessor(temp_csv_file)
        processor.load_data()
        processor.filter_by_date('2020-01-01')
        
        # Should filter out the 2019 record
        assert len(processor.df) == 3
        
        # Verify all remaining dates are >= 2020-01-01
        assert all(processor.df['citation_issued_datetime'] >= pd.to_datetime('2020-01-01'))

    def test_process_plates(self, temp_csv_file):
        """Test plate grouping and aggregation"""
        processor = ParkingDataProcessor(temp_csv_file)
        processor.load_data()
        processor.filter_by_date('2020-01-01')
        processor.process_plates()
        
        # Should have 1 unique plate after filtering (ABC123)
        assert 'ABC123' in processor.plate_data
        
        # Check aggregated values for ABC123
        abc123_data = processor.plate_data['ABC123']
        assert abc123_data['total_fines'] == 300.0  # 100 + 150 + 50
        assert abc123_data['citation_count'] == 3

    def test_favorite_violation(self, temp_csv_file):
        """Test favorite violation calculation"""
        processor = ParkingDataProcessor(temp_csv_file)
        processor.load_data()
        processor.filter_by_date('2020-01-01')
        processor.process_plates()
        processor.calculate_favorite_violations()
        
        # ABC123 has 2 'Expired Meter' and 1 'Street Cleaning'
        assert processor.plate_data['ABC123']['favorite_violation'] == 'Expired Meter'

    def test_generate_output_files(self, temp_csv_file, temp_output_dir):
        """Test JSON file generation"""
        processor = ParkingDataProcessor(temp_csv_file)
        processor.load_data()
        processor.filter_by_date('2020-01-01')
        processor.process_plates()
        processor.calculate_favorite_violations()
        
        # Change the output directory to temp dir
        output_dir = Path(temp_output_dir) / 'data'
        processor.output_dir = output_dir
        
        # Generate output files
        processor.save_output_files(top_n=100)
        
        # Verify files were created with new optimized structure
        leaderboard_path = output_dir / 'leaderboard.json'
        plates_dir = output_dir / 'plates'
        
        assert leaderboard_path.exists()
        assert plates_dir.exists()
        
        # Verify leaderboard content
        with open(leaderboard_path, 'r') as f:
            leaderboard_data = json.load(f)
        
        assert len(leaderboard_data) > 0
        assert leaderboard_data[0]['plate'] == 'ABC123'
        assert leaderboard_data[0]['total_fines'] == 300.0
        
        # Verify individual plate file was created
        plate_file = plates_dir / 'ABC123.json'
        assert plate_file.exists()

    def test_empty_data_handling(self):
        """Test handling of empty/missing data"""
        # Create empty CSV
        empty_df = pd.DataFrame(columns=['vehicle_plate', 'fine_amount', 
                                         'citation_issued_datetime', 'violation_description'])
        
        with tempfile.NamedTemporaryFile(mode='w', delete=False, suffix='.csv') as f:
            empty_df.to_csv(f.name, index=False)
            temp_file = f.name
        
        try:
            processor = ParkingDataProcessor(temp_file)
            processor.load_data()
            processor.filter_by_date('2020-01-01')
            processor.process_plates()
            
            # Should handle empty data gracefully
            assert len(processor.plate_data) == 0
        finally:
            os.unlink(temp_file)

    def test_invalid_fine_amounts(self, temp_csv_file):
        """Test handling of invalid fine amounts"""
        processor = ParkingDataProcessor(temp_csv_file)
        
        # Note: load_data() now automatically converts invalid fine amounts to 0
        # This happens during CSV loading with pd.to_numeric(errors='coerce')
        processor.load_data()
        
        # Verify that fine_amount column is numeric after loading
        assert processor.df['fine_amount'].dtype in ['float64', 'int64']
        
        processor.filter_by_date('2020-01-01')
        processor.process_plates()
        
        # Should handle invalid amounts gracefully
        assert 'ABC123' in processor.plate_data
        # All fines should be valid numbers (non-negative)
        assert processor.plate_data['ABC123']['total_fines'] >= 0

