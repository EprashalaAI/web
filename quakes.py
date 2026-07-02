import urllib.request
import json
from datetime import datetime, timedelta

def generate_earthquake_database():
    print("Initiating connection to USGS Master Seismic Database...")
    
    # Query Magnitude 6.5 and above from 1924 to present.
    url = "https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&starttime=1924-01-01&endtime=2026-06-01&minmagnitude=6.5&orderby=time-asc"
    
    try:
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req) as response:
            data = json.loads(response.read().decode('utf-8'))
            
        features = data.get('features', [])
        total_events = len(features)
        print(f"Successfully retrieved {total_events} major seismic events.")
        
        js_records = []
        count = 1
        
        # Base Epoch for manual calculation to avoid Windows [Errno 22]
        epoch = datetime(1970, 1, 1)
        
        for feature in features:
            props = feature['properties']
            geom = feature['geometry']
            
            time_ms = props.get('time')
            if not time_ms:
                continue
                
            # THE FIX: Calculate date using timedelta instead of utcfromtimestamp
            dt = epoch + timedelta(milliseconds=time_ms)
            
            date_str = dt.strftime('%Y-%m-%d')
            time_str = dt.strftime('%H:%M:%S')
            
            # Clean up the location string for Javascript array safety
            loc_str = props.get('place', 'Unknown Location')
            if loc_str:
                loc_str = loc_str.replace('"', '').replace("'", "").replace('\\', '')
                
            mag = props.get('mag', 0.0)
            lon = geom['coordinates'][0]
            lat = geom['coordinates'][1]
            
            # Format exactly as required by the frontend UI
            record = f'    {{ id: {count}, location: "{loc_str}", mag: {mag}, date: "{date_str}", time: "{time_str}", lat: {lat:.4f}, lon: {lon:.4f} }}'
            js_records.append(record)
            count += 1

        # Construct the final Javascript file content
        js_content = "// AUTO-GENERATED HISTORICAL SEISMIC DATASET\n"
        js_content += "// Source: USGS | Range: Last 100 Years | Magnitude: 6.5+\n\n"
        js_content += "let earthquakes = [\n"
        js_content += ",\n".join(js_records)
        js_content += "\n];\n"

        # Write to the external .js file
        with open('earthquakes.js', 'w', encoding='utf-8') as f:
            f.write(js_content)
            
        print("Data compilation complete. 'earthquakes.js' has been successfully created.")
        print("Refresh your HTML page to load the new data.")

    except Exception as e:
        print(f"An error occurred: {str(e)}")

if __name__ == "__main__":
    generate_earthquake_database()