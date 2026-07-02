import swisseph as swe
import datetime
import json

# Define the time range (next 100 years)
start_date = datetime.date(2024, 1, 1)
end_date = datetime.date(2124, 1, 1)
delta = datetime.timedelta(days=1)

tension_windows = []

current_date = start_date
while current_date <= end_date:
    # Convert date to Julian Day (required by Swiss Ephemeris)
    year, month, day = current_date.year, current_date.month, current_date.day
    jd = swe.julday(year, month, day, 0.0) # 0.0 is midnight UTC
    
    # Get positions (longitude) for Sun, Moon, Mars, Saturn
    sun_pos = swe.calc_ut(jd, swe.SUN)[0][0]
    moon_pos = swe.calc_ut(jd, swe.MOON)[0][0]
    mars_pos = swe.calc_ut(jd, swe.MARS)[0][0]
    saturn_pos = swe.calc_ut(jd, swe.SATURN)[0][0]
    
    # RULE 1: Syzygy (Sun and Moon conjunct or opposite within 3 degrees)
    sun_moon_diff = abs(sun_pos - moon_pos)
    is_syzygy = sun_moon_diff <= 3 or abs(sun_moon_diff - 180) <= 3
    
    # RULE 2: Mars/Saturn Hard Aspect (Conjunct or Square within 3 degrees)
    mars_sat_diff = abs(mars_pos - saturn_pos)
    is_hard_aspect = mars_sat_diff <= 3 or abs(mars_sat_diff - 90) <= 3 or abs(mars_sat_diff - 180) <= 3
    
    # If both tension rules align, save it to our dataset!
    if is_syzygy and is_hard_aspect:
        tension_windows.append({
            "date": current_date.strftime("%Y-%m-%d"),
            "year": year,
            "sun_deg": round(sun_pos, 2),
            "moon_deg": round(moon_pos, 2),
            "mars_deg": round(mars_pos, 2),
            "saturn_deg": round(saturn_pos, 2),
            "risk_level": "High - Combined Syzygy and Mars/Saturn Aspect"
        })
        
    current_date += delta

# Export to a JSON file
with open('seismic_tension_data.json', 'w') as f:
    json.dump(tension_windows, f, indent=4)
    
print("100-year dataset generated successfully!")