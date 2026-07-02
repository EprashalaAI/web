// bphs.js
const bphsData = {
'karaka': {
        title: "Bhav Karak (House Significators) & Medical Astrology",
        html: `<table class="bphs-table">
            <tr>
                <th>Bhava (House) & Type</th>
                <th>Primary Karaka(s)</th>
                <th>Core Significations</th>
                <th>Body Parts (Kaal Purusha)</th>
            </tr>
            <tr>
                <td>1st (Lagna)<br><span style="color: green; font-size: 0.9em;">Kendra</span>, <span style="color: deeppink; font-size: 0.9em;">Trikon</span></td>
                <td><span style="color: #D35400; font-weight: bold;">Surya (Sun)</span></td>
                <td>Self, Vitality, Body, Soul</td>
                <td>Head, Brain, Hair, Overall Physical Body</td>
            </tr>
            <tr>
                <td>2nd<br><span style="color: red; font-size: 0.9em;">Marak</span></td>
                <td><span style="color: #DAA520; font-weight: bold;">Guru (Jupiter)</span></td>
                <td>Wealth, Speech, Family, Food</td>
                <td>Face, Right Eye, Teeth, Tongue, Throat</td>
            </tr>
            <tr>
                <td>3rd<br><span style="color: darkorange; font-size: 0.9em;">Upachay</span></td>
                <td><span style="color: #C0392B; font-weight: bold;">Mangal (Mars)</span></td>
                <td>Courage, Siblings, Effort, Valor</td>
                <td>Neck, Shoulders, Arms, Hands, Collarbone</td>
            </tr>
            <tr>
                <td>4th<br><span style="color: green; font-size: 0.9em;">Kendra</span></td>
                <td><span style="color: #708090; font-weight: bold;">Chandra (Moon)</span>, <span style="color: #27AE60; font-weight: bold;">Budh (Mercury)</span></td>
                <td>Mother, Mind, Home, Vehicles, Education</td>
                <td>Chest, Heart, Lungs, Breasts</td>
            </tr>
            <tr>
                <td>5th<br><span style="color: deeppink; font-size: 0.9em;">Trikon</span></td>
                <td><span style="color: #DAA520; font-weight: bold;">Guru (Jupiter)</span></td>
                <td>Children, Intellect, Mantra, Past Punya</td>
                <td>Upper Abdomen, Stomach, Liver, Spleen</td>
            </tr>
            <tr>
                <td>6th<br><span style="color: #5C4033; font-size: 0.9em;">Trik</span>, <span style="color: darkorange; font-size: 0.9em;">Upachay</span></td>
                <td><span style="color: #C0392B; font-weight: bold;">Mangal (Mars)</span>, <span style="color: #000080; font-weight: bold;">Shani (Saturn)</span></td>
                <td>Diseases, Debts, Enemies, Service</td>
                <td>Lower Abdomen, Intestines, Kidneys, Navel</td>
            </tr>
            <tr>
                <td>7th<br><span style="color: green; font-size: 0.9em;">Kendra</span>, <span style="color: red; font-size: 0.9em;">Marak</span></td>
                <td><span style="color: #C71585; font-weight: bold;">Shukra (Venus)</span></td>
                <td>Spouse, Partnerships, Desires</td>
                <td>Pelvic Region, Internal Reproductive Organs</td>
            </tr>
            <tr>
                <td>8th<br><span style="color: #5C4033; font-size: 0.9em;">Trik</span></td>
                <td><span style="color: #000080; font-weight: bold;">Shani (Saturn)</span></td>
                <td>Longevity, Occult, Sudden Changes</td>
                <td>External Genitalia, Excretory Organs, Anus</td>
            </tr>
            <tr>
                <td>9th<br><span style="color: deeppink; font-size: 0.9em;">Trikon</span></td>
                <td><span style="color: #DAA520; font-weight: bold;">Guru (Jupiter)</span>, <span style="color: #D35400; font-weight: bold;">Surya (Sun)</span></td>
                <td>Dharma, Father, Guru, Luck</td>
                <td>Thighs, Hips, Arterial System</td>
            </tr>
            <tr>
                <td>10th<br><span style="color: green; font-size: 0.9em;">Kendra</span>, <span style="color: darkorange; font-size: 0.9em;">Upachay</span></td>
                <td><span style="color: #D35400; font-weight: bold;">Surya</span>, <span style="color: #27AE60; font-weight: bold;">Budh</span>, <span style="color: #DAA520; font-weight: bold;">Guru</span>, <span style="color: #000080; font-weight: bold;">Shani</span></td>
                <td>Karma, Profession, Status, Authority</td>
                <td>Knees, Joints, Bones</td>
            </tr>
            <tr>
                <td>11th<br><span style="color: darkorange; font-size: 0.9em;">Upachay</span></td>
                <td><span style="color: #DAA520; font-weight: bold;">Guru (Jupiter)</span></td>
                <td>Gains, Elder Siblings, Desires Fulfilled</td>
                <td>Calves, Ankles, Left Ear</td>
            </tr>
            <tr>
                <td>12th<br><span style="color: #5C4033; font-size: 0.9em;">Trik</span></td>
                <td><span style="color: #000080; font-weight: bold;">Shani (Saturn)</span>, <span style="color: #8B4513; font-weight: bold;">Ketu</span></td>
                <td>Losses, Moksha, Foreign Lands, Isolation</td>
                <td>Feet, Toes, Left Eye</td>
            </tr>
        </table>`
    },
'swami': {
        title: "Rashi Swami (Sign Lords) & Graha Devata and characteristics",
        html: `<table class="bphs-table">
            <tr>
                <th>Rashi (Sign)</th>
                <th>Swami / ग्रह</th>
                <th>Guna / गुण</th>
                <th>Varna / वर्ण</th>
                <th>Gender / लिंग</th>
                <th>Authority / पद</th>
                <th>Deity (Graha / Avatar)</th>
            </tr>
            <tr>
                <td>Aries (Mesh) - 1</td>
                <td><span style="color: #E74C3C; font-weight: bold;">Mangal (Mars)</span></td>
                <td>Tamsik / तामसिक</td>
                <td>Kshatriya / क्षत्रिय</td>
                <td>Male / पुरुष</td>
                <td>Commander / सेनापति</td>
                <td>Kartikeya / Sri Narasimha</td>
            </tr>
            <tr>
                <td>Taurus (Vrish) - 2</td>
                <td><span style="color: #FF69B4; font-weight: bold;">Shukra (Venus)</span></td>
                <td>Rajsik / राजसिक</td>
                <td>Brahmin / ब्राह्मण</td>
                <td>Female / स्त्री</td>
                <td>Minister / मंत्री</td>
                <td>Indrani / Sri Parashurama</td>
            </tr>
            <tr>
                <td>Gemini (Mithun) - 3</td>
                <td><span style="color: #2ECC71; font-weight: bold;">Budh (Mercury)</span></td>
                <td>Rajsik / राजसिक</td>
                <td>Vaishya / वैश्य</td>
                <td>Male+Napunsak / पुरुष+नपुंसक</td>
                <td>Prince / युवराज</td>
                <td>Vishnu / Sri Buddha</td>
            </tr>
            <tr>
                <td>Cancer (Karka) - 4</td>
                <td><span style="color: #E0E0E0; font-weight: bold;">Chandra (Moon)</span></td>
                <td>Satvik / सात्विक</td>
                <td>Vaishya / वैश्य</td>
                <td>Female / स्त्री</td>
                <td>Queen / रानी</td>
                <td>Varun / Sri Krishna</td>
            </tr>
            <tr>
                <td>Leo (Simha) - 5</td>
                <td><span style="color: #F39C12; font-weight: bold;">Surya (Sun)</span></td>
                <td>Satvik / सात्विक</td>
                <td>Kshatriya / क्षत्रिय</td>
                <td>Male / पुरुष</td>
                <td>King / राजा</td>
                <td>Agni / Sri Rama</td>
            </tr>
            <tr>
                <td>Virgo (Kanya) - 6</td>
                <td><span style="color: #2ECC71; font-weight: bold;">Budh (Mercury)</span></td>
                <td>Rajsik / राजसिक</td>
                <td>Vaishya / वैश्य</td>
                <td>Male+Napunsak / पुरुष+नपुंसक</td>
                <td>Prince / युवराज</td>
                <td>Vishnu / Sri Buddha</td>
            </tr>
            <tr>
                <td>Libra (Tula) - 7</td>
                <td><span style="color: #FF69B4; font-weight: bold;">Shukra (Venus)</span></td>
                <td>Rajsik / राजसिक</td>
                <td>Brahmin / ब्राह्मण</td>
                <td>Female / स्त्री</td>
                <td>Minister / मंत्री</td>
                <td>Indrani / Sri Parashurama</td>
            </tr>
            <tr>
                <td>Scorpio (Vrishchik) - 8</td>
                <td><span style="color: #E74C3C; font-weight: bold;">Mangal</span> / <span style="color: #CD853F; font-weight: bold;">Ketu</span></td>
                <td>Tamsik / तामसिक</td>
                <td>Kshatriya / क्षत्रिय<br>Malechha / म्लेच्छ</td>
                <td>Male / पुरुष<br>Napunsak / नपुंसक</td>
                <td>Commander / सेनापति<br>Army / सेना</td>
                <td>Kartikeya / Sri Narasimha<br>Ganesha / Sri Matsya</td>
            </tr>
            <tr>
                <td>Sagittarius (Dhanu) - 9</td>
                <td><span style="color: #F1C40F; font-weight: bold;">Guru (Jupiter)</span></td>
                <td>Satvik / सात्विक</td>
                <td>Brahmin / ब्राह्मण</td>
                <td>Male / पुरुष</td>
                <td>Minister / मंत्री</td>
                <td>Indra / Sri Vamana</td>
            </tr>
            <tr>
                <td>Capricorn (Makar) - 10</td>
                <td><span style="color: #6495ED; font-weight: bold;">Shani (Saturn)</span></td>
                <td>Tamsik / तामसिक</td>
                <td>Shudra / शूद्र</td>
                <td>Female+Napunsak / स्त्री+नपुंसक</td>
                <td>Servant / सेवक</td>
                <td>Brahma / Sri Kurma</td>
            </tr>
            <tr>
                <td>Aquarius (Kumbha) - 11</td>
                <td><span style="color: #6495ED; font-weight: bold;">Shani</span> / <span style="color: #A9A9A9; font-weight: bold;">Rahu</span></td>
                <td>Tamsik / तामसिक</td>
                <td>Shudra / शूद्र<br>Malechha / म्लेच्छ</td>
                <td>Female+Napunsak / स्त्री+नपुंसक<br>Napunsak / नपुंसक</td>
                <td>Servant / सेवक<br>Army / सेना</td>
                <td>Brahma / Sri Kurma<br>Brahma,Laxmi / Sri Varaha</td>
            </tr>
            <tr>
                <td>Pisces (Meen) - 12</td>
                <td><span style="color: #F1C40F; font-weight: bold;">Guru (Jupiter)</span></td>
                <td>Satvik / सात्विक</td>
                <td>Brahmin / ब्राह्मण</td>
                <td>Male / पुरुष</td>
                <td>Minister / मंत्री</td>
                <td>Indra / Sri Vamana</td>
            </tr>
        </table>`
    },
    'combustion': {
        title: "Combustion (Asta) Orbs from Surya",
        html: `<table class="bphs-table">
            <tr><th>Graha</th><th>Direct Combustion</th><th>Retrograde (Vakri)</th><th>Deep combust</th></tr>
            <tr><td>Chandra</td><td>12°</td><td>NA</td><td>≤ 3°</td></tr>
            <tr><td>Mangal</td><td>17°</td><td>17°</td><td>≤ 8°</td></tr>
            <tr><td>Budh</td><td>14°</td><td>12°</td><td>≤ 5°</td></tr>
            <tr><td>Guru</td><td>11°</td><td>11°</td><td>≤ 5°</td></tr>
            <tr><td>Shukra</td><td>10°</td><td>8°</td><td>≤ 3°</td></tr>
            <tr><td>Shani</td><td>15°</td><td>15°</td><td>≤ 7°</td></tr>
        </table>`
    },
	'dignity': {
        title: "Ucha (Exaltation) & Neecha (Debilitation)",
        html: `<table class="bphs-table">
            <tr><th>Graha</th><th>Ucha Rashi (Exact Degree)</th><th>Neecha Rashi (Exact Degree)</th></tr>
            <tr><td>Surya</td><td>Aries (1) (10°)</td><td>Libra (7) (10°)</td></tr>
            <tr><td>Chandra</td><td>Taurus (2) (3°)</td><td>Scorpio (8) (3°)</td></tr>
            <tr><td>Mangal</td><td>Capricorn (10) (28°)</td><td>Cancer (4) (28°)</td></tr>
            <tr><td>Budh</td><td>Virgo (6) (15°)</td><td>Pisces (12) (15°)</td></tr>
            <tr><td>Guru</td><td>Cancer (4) (5°)</td><td>Capricorn (10) (5°)</td></tr>
            <tr><td>Shukra</td><td>Pisces (12) (27°)</td><td>Virgo (6) (27°)</td></tr>
            <tr><td>Shani</td><td>Libra (7) (20°)</td><td>Aries (1) (20°)</td></tr>
            <tr><td>Rahu</td><td>Taurus (2) / Gemini (3)</td><td>Scorpio (8) / Sagittarius (9)</td></tr>
            <tr><td>Ketu</td><td>Scorpio (8) / Sagittarius (9)</td><td>Taurus (2) / Gemini (3)</td></tr>
        </table>`
    },
    'mooltrikona': {
        title: "Mooltrikona (Root Trine) Positions",
        html: `<table class="bphs-table">
            <tr><th>Graha</th><th>Mooltrikona Rashi</th><th>Degree Range</th></tr>
            <tr><td>Surya</td><td>Leo</td><td>0° to 20°</td></tr>
            <tr><td>Chandra</td><td>Taurus</td><td>4° to 20°</td></tr>
            <tr><td>Mangal</td><td>Aries</td><td>0° to 12°</td></tr>
            <tr><td>Budh</td><td>Virgo</td><td>16° to 20°</td></tr>
            <tr><td>Guru</td><td>Sagittarius</td><td>0° to 10°</td></tr>
            <tr><td>Shukra</td><td>Libra</td><td>0° to 15°</td></tr>
            <tr><td>Shani</td><td>Aquarius</td><td>0° to 20°</td></tr>
        </table>`
    },
    'drishti': {
        title: "Graha Drishti (Aspects)",
        html: `<table class="bphs-table">
            <tr><th>Graha</th><th>Normal Drishti</th><th>Special Drishti</th></tr>
            <tr><td>Surya, Chandra, Budh, Shukra</td><td>7th House</td><td>-</td></tr>
            <tr><td>Mangal</td><td>7th House</td><td>4th & 8th House</td></tr>
            <tr><td>Guru</td><td>7th House</td><td>5th & 9th House</td></tr>
            <tr><td>Shani</td><td>7th House</td><td>3rd & 10th House</td></tr>
            <tr><td>Rahu / Ketu</td><td>7th House</td><td>5th & 9th House</td></tr>
        </table>`
    },
    'digbala': {
        title: "Digbala (Directional Strength)",
        html: `<table class="bphs-table">
            <tr><th>Direction</th><th>Bhava (House)</th><th>Grahas with Digbala (Maximum Power)</th><th>Zero Digbala House</th></tr>
            <tr><td>East</td><td>1st House (Lagna)</td><td>Guru, Budh</td><td>7th House</td></tr>
            <tr><td>North</td><td>4th House (Nadir)</td><td>Chandra, Shukra</td><td>10th House</td></tr>
            <tr><td>West</td><td>7th House (Descendant)</td><td>Shani</td><td>1st House</td></tr>
            <tr><td>South</td><td>10th House (Zenith)</td><td>Surya, Mangal</td><td>4th House</td></tr>
        </table>`
    },
    'awastha': {
        title: "Awastha (Planetary Age/State) by Sign",
        html: `<table class="bphs-table matrix-table" style="font-size:12px;">
            <tr><th style="width: 120px;">Rashi (Sign)</th><th>0° to 6°</th><th>6° to 12°</th><th>12° to 18°</th><th>18° to 24°</th><th>24° to 30°</th></tr>
            <tr><th style="color:#ef4444;">1. Aries (Odd)</th><td>Bala 👶</td><td>Kumara 👦</td><td>Yuva 👨</td><td>Vriddha 👴</td><td>Mrita 💀</td></tr>
            <tr><th style="color:#fbcfe8;">2. Taurus (Even)</th><td>Mrita 💀</td><td>Vriddha 👴</td><td>Yuva 👨</td><td>Kumara 👦</td><td>Bala 👶</td></tr>
            <tr><th style="color:#10b981;">3. Gemini (Odd)</th><td>Bala 👶</td><td>Kumara 👦</td><td>Yuva 👨</td><td>Vriddha 👴</td><td>Mrita 💀</td></tr>
            <tr><th style="color:#f8fafc;">4. Cancer (Even)</th><td>Mrita 💀</td><td>Vriddha 👴</td><td>Yuva 👨</td><td>Kumara 👦</td><td>Bala 👶</td></tr>
            <tr><th style="color:#f1c40f;">5. Leo (Odd)</th><td>Bala 👶</td><td>Kumara 👦</td><td>Yuva 👨</td><td>Vriddha 👴</td><td>Mrita 💀</td></tr>
            <tr><th style="color:#10b981;">6. Virgo (Even)</th><td>Mrita 💀</td><td>Vriddha 👴</td><td>Yuva 👨</td><td>Kumara 👦</td><td>Bala 👶</td></tr>
            <tr><th style="color:#fbcfe8;">7. Libra (Odd)</th><td>Bala 👶</td><td>Kumara 👦</td><td>Yuva 👨</td><td>Vriddha 👴</td><td>Mrita 💀</td></tr>
            <tr><th style="color:#ef4444;">8. Scorpio (Even)</th><td>Mrita 💀</td><td>Vriddha 👴</td><td>Yuva 👨</td><td>Kumara 👦</td><td>Bala 👶</td></tr>
            <tr><th style="color:#f59e0b;">9. Sagittarius (Odd)</th><td>Bala 👶</td><td>Kumara 👦</td><td>Yuva 👨</td><td>Vriddha 👴</td><td>Mrita 💀</td></tr>
            <tr><th style="color:#e2e8f0;">10. Capricorn (Even)</th><td>Mrita 💀</td><td>Vriddha 👴</td><td>Yuva 👨</td><td>Kumara 👦</td><td>Bala 👶</td></tr>
            <tr><th style="color:#e2e8f0;">11. Aquarius (Odd)</th><td>Bala 👶</td><td>Kumara 👦</td><td>Yuva 👨</td><td>Vriddha 👴</td><td>Mrita 💀</td></tr>
            <tr><th style="color:#f59e0b;">12. Pisces (Even)</th><td>Mrita 💀</td><td>Vriddha 👴</td><td>Yuva 👨</td><td>Kumara 👦</td><td>Bala 👶</td></tr>
        </table>`
    },
'maitri': {
        title: "Naisargika Maitri (Planetary Friendship Matrix)",
        html: `<table class="bphs-table matrix-table">
            <tr>
                <th>Planet A \\ B</th>
                <th>Surya</th>
                <th>Chandra</th>
                <th>Mangal</th>
                <th>Budh</th>
                <th>Guru</th>
                <th>Shukra</th>
                <th>Shani</th>
                <th>Rahu</th>
                <th>Ketu</th>
            </tr>
            <tr>
                <th style="color:#f1c40f;">Surya</th>
                <td class="text-neutral">-</td>
                <td class="text-friend">Friend</td>
                <td class="text-friend">Friend</td>
                <td class="text-neutral">Neutral</td>
                <td class="text-friend">Friend</td>
                <td class="text-enemy">Enemy</td>
                <td class="text-enemy">Enemy</td>
                <td class="text-enemy">Enemy</td>
                <td class="text-enemy">Enemy</td>
            </tr>
            <tr>
                <th style="color:#f8fafc;">Chandra</th>
                <td class="text-friend">Friend</td>
                <td class="text-neutral">-</td>
                <td class="text-neutral">Neutral</td>
                <td class="text-friend">Friend</td>
                <td class="text-neutral">Neutral</td>
                <td class="text-neutral">Neutral</td>
                <td class="text-neutral">Neutral</td>
                <td class="text-enemy">Enemy</td>
                <td class="text-enemy">Enemy</td>
            </tr>
            <tr>
                <th style="color:#ef4444;">Mangal</th>
                <td class="text-friend">Friend</td>
                <td class="text-friend">Friend</td>
                <td class="text-neutral">-</td>
                <td class="text-enemy">Enemy</td>
                <td class="text-friend">Friend</td>
                <td class="text-neutral">Neutral</td>
                <td class="text-neutral">Neutral</td>
                <td class="text-enemy">Enemy</td>
                <td class="text-enemy">Enemy</td>
            </tr>
            <tr>
                <th style="color:#10b981;">Budh</th>
                <td class="text-friend">Friend</td>
                <td class="text-enemy">Enemy</td>
                <td class="text-neutral">Neutral</td>
                <td class="text-neutral">-</td>
                <td class="text-neutral">Neutral</td>
                <td class="text-friend">Friend</td>
                <td class="text-neutral">Neutral</td>
                <td class="text-neutral">Neutral</td>
                <td class="text-neutral">Neutral</td>
            </tr>
            <tr>
                <th style="color:#f59e0b;">Guru</th>
                <td class="text-friend">Friend</td>
                <td class="text-friend">Friend</td>
                <td class="text-friend">Friend</td>
                <td class="text-enemy">Enemy</td>
                <td class="text-neutral">-</td>
                <td class="text-enemy">Enemy</td>
                <td class="text-neutral">Neutral</td>
                <td class="text-neutral">Neutral</td>
                <td class="text-neutral">Neutral</td>
            </tr>
            <tr>
                <th style="color:#fbcfe8;">Shukra</th>
                <td class="text-enemy">Enemy</td>
                <td class="text-enemy">Enemy</td>
                <td class="text-neutral">Neutral</td>
                <td class="text-friend">Friend</td>
                <td class="text-neutral">Neutral</td>
                <td class="text-neutral">-</td>
                <td class="text-friend">Friend</td>
                <td class="text-friend">Friend</td>
                <td class="text-friend">Friend</td>
            </tr>
            <tr>
                <th style="color:#6495ED;">Shani</th>
                <td class="text-enemy">Enemy</td>
                <td class="text-enemy">Enemy</td>
                <td class="text-enemy">Enemy</td>
                <td class="text-friend">Friend</td>
                <td class="text-neutral">Neutral</td>
                <td class="text-friend">Friend</td>
                <td class="text-neutral">-</td>
                <td class="text-friend">Friend</td>
                <td class="text-friend">Friend</td>
            </tr>
            <tr>
                <th style="color:#A9A9A9;">Rahu</th>
                <td class="text-enemy">Enemy</td>
                <td class="text-enemy">Enemy</td>
                <td class="text-enemy">Enemy</td>
                <td class="text-friend">Friend</td>
                <td class="text-neutral">Neutral</td>
                <td class="text-friend">Friend</td>
                <td class="text-friend">Friend</td>
                <td class="text-neutral">-</td>
                <td class="text-neutral">Neutral</td>
            </tr>
            <tr>
                <th style="color:#CD853F;">Ketu</th>
                <td class="text-enemy">Enemy</td>
                <td class="text-enemy">Enemy</td>
                <td class="text-enemy">Enemy</td>
                <td class="text-friend">Friend</td>
                <td class="text-neutral">Neutral</td>
                <td class="text-friend">Friend</td>
                <td class="text-friend">Friend</td>
                <td class="text-neutral">Neutral</td>
                <td class="text-neutral">-</td>
            </tr>
        </table>`
    },
'nakshatra': {
        title: "27 Nakshatras, Lords & Kaalpurusha Body Parts",
        html: `
        <div style="margin-bottom: 12px; font-size: 12px; background: rgba(0,0,0,0.5); padding: 8px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.1); text-align: center;">
            <span style="color:#f97316; font-weight:bold;">■ Orange (Shubh / Auspicious)</span> &nbsp;|&nbsp;
            <span style="color:#f472b6; font-weight:bold;">■ Pink (Good / Gentle)</span> &nbsp;|&nbsp;
            <span style="color:#ffffff; font-weight:bold;">■ White (Neutral / Mixed)</span> &nbsp;|&nbsp;
            <span style="color:#ef4444; font-weight:bold;">■ Red (Very Bad / Fierce)</span>
        </div>
        <table class="bphs-table" style="font-size:13px;">
            <tr>
                <th>#</th>
                <th>Nakshatra</th>
                <th>Lord (Swami)</th>
                <th>Nature / Gana</th>
                <th>Core Characteristic</th>
                <th>Body Parts (Kaalpurusha)</th>
            </tr>
            <tr><td>1</td><td style="color:#f472b6; font-weight:bold;">Ashwini</td><td style="color:#78716c">Ketu</td><td>Swift (Light)</td><td>Speed, Healing, Beginnings</td><td>Head, Brain</td></tr>
            <tr><td>2</td><td style="color:#ef4444; font-weight:bold;">Bharani</td><td style="color:#fbcfe8">Shukra</td><td>Fierce (Severe)</td><td>Restraint, Transformation, Struggle</td><td>Forehead, Eyes, Head Organs</td></tr>
            <tr><td>3</td><td style="color:#ffffff; font-weight:bold;">Krittika</td><td style="color:#f1c40f">Surya</td><td>Mixed (Neutral)</td><td>Purification, Cutting, Ambition</td><td>Face, Neck, Tonsils, Larynx</td></tr>
            <tr><td>4</td><td style="color:#f97316; font-weight:bold;">Rohini</td><td style="color:#f8fafc">Chandra</td><td>Fixed (Stable)</td><td>Growth, Fertility, Material Desires</td><td>Mouth, Tongue, Neck</td></tr>
            <tr><td>5</td><td style="color:#f472b6; font-weight:bold;">Mrigashira</td><td style="color:#ef4444">Mangal</td><td>Tender (Gentle)</td><td>Seeking, Searching, Curiosity</td><td>Chin, Cheeks, Shoulders</td></tr>
            <tr><td>6</td><td style="color:#ef4444; font-weight:bold;">Ardra</td><td style="color:#94a3b8">Rahu</td><td>Sharp (Dreadful)</td><td>Destruction, Storms, Effort</td><td>Arms, Shoulders, Neck</td></tr>
            <tr><td>7</td><td style="color:#f97316; font-weight:bold;">Punarvasu</td><td style="color:#f59e0b">Guru</td><td>Movable (Chara)</td><td>Renewal, Return of Light, Safety</td><td>Fingers, Nose, Respiratory System</td></tr>
            <tr><td>8</td><td style="color:#f97316; font-weight:bold;">Pushya</td><td style="color:#e2e8f0">Shani</td><td>Swift (Highly Shubh)</td><td>Nourishment, Auspiciousness, Care</td><td>Lungs, Stomach, Ribs</td></tr>
            <tr><td>9</td><td style="color:#ef4444; font-weight:bold;">Ashlesha</td><td style="color:#10b981">Budh</td><td>Sharp (Dreadful)</td><td>Clinging, Poison, Mysticism</td><td>Esophagus, Pancreas, Joints</td></tr>
            <tr><td>10</td><td style="color:#ef4444; font-weight:bold;">Magha</td><td style="color:#78716c">Ketu</td><td>Fierce (Severe)</td><td>Royalty, Ancestors, Heritage</td><td>Heart, Back, Spine</td></tr>
            <tr><td>11</td><td style="color:#ef4444; font-weight:bold;">Purva Phalguni</td><td style="color:#fbcfe8">Shukra</td><td>Fierce (Severe)</td><td>Rest, Relaxation, Enjoyment</td><td>Heart, Spine, Reproductive Organs</td></tr>
            <tr><td>12</td><td style="color:#f97316; font-weight:bold;">Uttara Phalguni</td><td style="color:#f1c40f">Surya</td><td>Fixed (Stable)</td><td>Patronage, Charity, Contracts</td><td>Intestines, Lower Spine</td></tr>
            <tr><td>13</td><td style="color:#f472b6; font-weight:bold;">Hasta</td><td style="color:#f8fafc">Chandra</td><td>Swift (Light)</td><td>Skill with hands, Grasping, Craft</td><td>Hands, Fingers, Bowels</td></tr>
            <tr><td>14</td><td style="color:#f472b6; font-weight:bold;">Chitra</td><td style="color:#ef4444">Mangal</td><td>Tender (Gentle)</td><td>Architecture, Brilliance, Magic</td><td>Kidneys, Lower Spine, Loins</td></tr>
            <tr><td>15</td><td style="color:#f97316; font-weight:bold;">Swati</td><td style="color:#94a3b8">Rahu</td><td>Movable (Chara)</td><td>Independence, Wind, Scatter</td><td>Skin, Kidneys, Urinary Tract, Chest</td></tr>
            <tr><td>16</td><td style="color:#ffffff; font-weight:bold;">Vishakha</td><td style="color:#f59e0b">Guru</td><td>Mixed (Neutral)</td><td>Purpose, Triumph, Fixation</td><td>Lower Abdomen, Bladder, Breasts</td></tr>
            <tr><td>17</td><td style="color:#f472b6; font-weight:bold;">Anuradha</td><td style="color:#e2e8f0">Shani</td><td>Tender (Gentle)</td><td>Success, Devotion, Friendship</td><td>Bladder, Rectum, Genitals</td></tr>
            <tr><td>18</td><td style="color:#ef4444; font-weight:bold;">Jyeshtha</td><td style="color:#10b981">Budh</td><td>Sharp (Dreadful)</td><td>Seniority, Protection, Eldest</td><td>Colon, Anus, Ovaries, Womb</td></tr>
            <tr><td>19</td><td style="color:#ef4444; font-weight:bold;">Mula</td><td style="color:#78716c">Ketu</td><td>Sharp (Dreadful)</td><td>Roots, Destruction, Unearthing</td><td>Hips, Thighs, Sciatic Nerve</td></tr>
            <tr><td>20</td><td style="color:#ef4444; font-weight:bold;">Purva Ashadha</td><td style="color:#fbcfe8">Shukra</td><td>Fierce (Severe)</td><td>Invincibility, Water, Faith</td><td>Thighs, Pelvic Region</td></tr>
            <tr><td>21</td><td style="color:#f97316; font-weight:bold;">Uttara Ashadha</td><td style="color:#f1c40f">Surya</td><td>Fixed (Stable)</td><td>Unchallenged Victory, Alliance</td><td>Knees, Thighs</td></tr>
            <tr><td>22</td><td style="color:#f97316; font-weight:bold;">Shravana</td><td style="color:#f8fafc">Chandra</td><td>Movable (Chara)</td><td>Listening, Learning, Wisdom</td><td>Ears, Knees, Lymphatic System</td></tr>
            <tr><td>23</td><td style="color:#f97316; font-weight:bold;">Dhanishta</td><td style="color:#ef4444">Mangal</td><td>Movable (Chara)</td><td>Symphony, Wealth, Rhythm</td><td>Knee Caps, Calf Muscles, Back</td></tr>
            <tr><td>24</td><td style="color:#f97316; font-weight:bold;">Shatabhisha</td><td style="color:#94a3b8">Rahu</td><td>Movable (Chara)</td><td>Healing, Veils, 100 Physicians</td><td>Calves, Ankles, Jaw</td></tr>
            <tr><td>25</td><td style="color:#ef4444; font-weight:bold;">Purva Bhadrapada</td><td style="color:#f59e0b">Guru</td><td>Fierce (Severe)</td><td>Fire, Transformation, Zeal</td><td>Ankles, Sides of Legs, Ribs</td></tr>
            <tr><td>26</td><td style="color:#f97316; font-weight:bold;">Uttara Bhadrapada</td><td style="color:#e2e8f0">Shani</td><td>Fixed (Stable)</td><td>Deep Sleep, Depth, Wisdom</td><td>Shins, Soles of Feet</td></tr>
            <tr><td>27</td><td style="color:#f472b6; font-weight:bold;">Revati</td><td style="color:#10b981">Budh</td><td>Tender (Gentle)</td><td>Nourishment, Safe Journey, Wealth</td><td>Feet, Toes, Ankles</td></tr>
        </table>`
    },
    'yamartha': {
        title: "11. Yamartha (Planetary Shifts & Upagraha Kaalas)",
        html: `
        <div style="margin-bottom: 15px; font-size: 13px; color: #cbd5e1; line-height: 1.5;">
            <strong>Note:</strong> Standard timings assume a 6:00 AM Sunrise and 12-hour day. The day (Dinamaana) is divided into 8 equal parts called <strong>Yamardhas</strong> (approx 1.5 hours each). 
        </div>
        <table class="bphs-table matrix-table" style="font-size:12px;">
            <tr>
                <th style="width: 110px;">Kaala (Shift)</th>
                <th>Sun</th><th>Mon</th><th>Tue</th><th>Wed</th><th>Thu</th><th>Fri</th><th>Sat</th>
            </tr>
            <tr>
                <th style="color:#ef4444;">Rahu Kaal<br><span style="font-size:10px; color:#94a3b8;">(Poison/Obstacles)</span></th>
                <td>16:30 - 18:00<br><span style="color:#f1c40f; font-size:10px;">(Yamardha 8)</span></td>
                <td>07:30 - 09:00<br><span style="color:#f1c40f; font-size:10px;">(Yamardha 2)</span></td>
                <td>15:00 - 16:30<br><span style="color:#f1c40f; font-size:10px;">(Yamardha 7)</span></td>
                <td>12:00 - 13:30<br><span style="color:#f1c40f; font-size:10px;">(Yamardha 5)</span></td>
                <td>13:30 - 15:00<br><span style="color:#f1c40f; font-size:10px;">(Yamardha 6)</span></td>
                <td>10:30 - 12:00<br><span style="color:#f1c40f; font-size:10px;">(Yamardha 4)</span></td>
                <td>09:00 - 10:30<br><span style="color:#f1c40f; font-size:10px;">(Yamardha 3)</span></td>
            </tr>
            <tr>
                <th style="color:#f59e0b;">Yama Gandak<br><span style="font-size:10px; color:#94a3b8;">(Death/Danger)</span></th>
                <td>12:00 - 13:30<br><span style="color:#f1c40f; font-size:10px;">(Yamardha 5)</span></td>
                <td>10:30 - 12:00<br><span style="color:#f1c40f; font-size:10px;">(Yamardha 4)</span></td>
                <td>09:00 - 10:30<br><span style="color:#f1c40f; font-size:10px;">(Yamardha 3)</span></td>
                <td>07:30 - 09:00<br><span style="color:#f1c40f; font-size:10px;">(Yamardha 2)</span></td>
                <td>06:00 - 07:30<br><span style="color:#f1c40f; font-size:10px;">(Yamardha 1)</span></td>
                <td>15:00 - 16:30<br><span style="color:#f1c40f; font-size:10px;">(Yamardha 7)</span></td>
                <td>13:30 - 15:00<br><span style="color:#f1c40f; font-size:10px;">(Yamardha 6)</span></td>
            </tr>
            <tr>
                <th style="color:#6ee7b7;">Gulika Kaal<br><span style="font-size:10px; color:#94a3b8;">(Delay/Repetition)</span></th>
                <td>15:00 - 16:30<br><span style="color:#f1c40f; font-size:10px;">(Yamardha 7)</span></td>
                <td>13:30 - 15:00<br><span style="color:#f1c40f; font-size:10px;">(Yamardha 6)</span></td>
                <td>12:00 - 13:30<br><span style="color:#f1c40f; font-size:10px;">(Yamardha 5)</span></td>
                <td>10:30 - 12:00<br><span style="color:#f1c40f; font-size:10px;">(Yamardha 4)</span></td>
                <td>09:00 - 10:30<br><span style="color:#f1c40f; font-size:10px;">(Yamardha 3)</span></td>
                <td>07:30 - 09:00<br><span style="color:#f1c40f; font-size:10px;">(Yamardha 2)</span></td>
                <td>06:00 - 07:30<br><span style="color:#f1c40f; font-size:10px;">(Yamardha 1)</span></td>
            </tr>
        </table>
        <div style="margin-top: 15px;">
            <table class="bphs-table" style="font-size:13px;">
                <tr><th>Upagraha</th><th>Ruling Planet</th><th>Deep Details & Traits</th></tr>
                <tr><td style="color:#ef4444; font-weight:bold;">Rahu Kaal</td><td>Rahu</td><td>Highly inauspicious segment. Avoid starting new ventures, business deals, or auspicious travel. It clouds judgment and creates illusions.</td></tr>
                <tr><td style="color:#f59e0b; font-weight:bold;">Yamagandak</td><td>Ketu / Guru</td><td>The "Time of Death". Extremely unfavorable for medical surgeries, beginning treatments, or taking major life risks. Promotes loss.</td></tr>
                <tr><td style="color:#6ee7b7; font-weight:bold;">Gulika Kaal</td><td>Shani (Son of Saturn)</td><td>Whatever begins here repeats. <strong>Good for:</strong> Buying a house, accumulating wealth. <strong>Bad for:</strong> Funerals, taking loans, or selling property.</td></tr>
            </table>
        </div>`
    },
    'panchang': {
        title: "12. Panchang: Bhadra, Panchak & Karana",
        html: `
        <div style="margin-bottom: 15px; font-size: 13px; color: #cbd5e1; line-height: 1.5;">
            These timeframes represent specific shifts in the lunar cycle and spatial orientation that dictate whether an action will yield fruitful or destructive results.
        </div>
        <table class="bphs-table" style="font-size:13px;">
            <tr><th style="width: 120px;">Element</th><th>Nature</th><th>Deep Details & Calculation</th></tr>
            <tr>
                <td style="color:#ef4444; font-weight:bold;">Bhadra Kaal<br><span style="font-size:11px; color:#94a3b8;">(Vishti Karana)</span></td>
                <td>Highly Inauspicious</td>
                <td>Bhadra is the Vishti Karana (half of a specific Tithi). When Bhadra resides in Mrityu Loka (Earth), it is forbidden to do any auspicious work (marriages, Griha Pravesh). However, Bhadra is favorable for destructive acts like filing lawsuits, warfare, or occult practices.</td>
            </tr>
            <tr>
                <td style="color:#f97316; font-weight:bold;">Panchak<br><span style="font-size:11px; color:#94a3b8;">(Group of 5)</span></td>
                <td>Mixed / Caution</td>
                <td>Occurs when Chandra (Moon) transits the last 5 Nakshatras (Dhanishta 3rd pada to Revati), mapping to Aquarius and Pisces. <strong>Forbidden Acts:</strong> Traveling South (Yama's direction), gathering wood, building a house roof, making a bed, or cremating a body (risks 5 deaths in the family without proper Shanti puja).</td>
            </tr>
        </table>

        <h4 style="color: var(--accent-gold); margin: 20px 0 10px 0; font-size: 14px; text-transform: uppercase;">The 11 Karanas (Half-Tithis)</h4>
        <table class="bphs-table matrix-table" style="font-size:12px;">
            <tr><th>Type</th><th colspan="7">Names & Rulers</th></tr>
            <tr>
                <th style="color:#34d399;">7 Chara (Movable)</th>
                <td><strong>Bava</strong><br>(Indra)</td>
                <td><strong>Balava</strong><br>(Brahma)</td>
                <td><strong>Kaulava</strong><br>(Mitra)</td>
                <td><strong>Taitila</strong><br>(Vishwakarma)</td>
                <td><strong>Gara</strong><br>(Prithvi)</td>
                <td><strong>Vanija</strong><br>(Lakshmi)</td>
                <td style="color:#ef4444;"><strong>Vishti (Bhadra)</strong><br>(Yama)</td>
            </tr>
            <tr>
                <th style="color:#60a5fa;">4 Sthira (Fixed)</th>
                <td><strong>Shakuni</strong><br>(Kali)</td>
                <td><strong>Chatushpada</strong><br>(Vrishabha)</td>
                <td><strong>Naga</strong><br>(Naga)</td>
                <td><strong>Kintughna</strong><br>(Vayu)</td>
                <td colspan="3" style="color:#94a3b8; font-style:italic;">Occur only during Amavasya and Purnima transitions.</td>
            </tr>
        </table>`
    },
    'karakas_deep': {
        title: "13. Sthir (Fixed) & Chara (Variable) Karakas",
        html: `
        <div style="margin-bottom: 15px; font-size: 13px; color: #cbd5e1; line-height: 1.5;">
            In Jaimini and Parashari systems, <strong>Karakas (Significators)</strong> are divided into Fixed (Sthir) and Variable (Chara). While Sthir Karakas remain the same for everyone, Chara Karakas are unique to a person's birth chart based on planetary degrees.
        </div>

        <h4 style="color: var(--accent-gold); margin: 20px 0 10px 0; font-size: 14px; text-transform: uppercase;">Sthir Karakas (Fixed Significators)</h4>
        <table class="bphs-table" style="font-size:13px;">
            <tr><th style="width: 120px;">Planet</th><th>Represents (Sthir Karaka)</th></tr>
            <tr><td style="color:#f1c40f; font-weight:bold;">Surya (Sun)</td><td>Father, Soul, Vitality, Authority</td></tr>
            <tr><td style="color:#f8fafc; font-weight:bold;">Chandra (Moon)</td><td>Mother, Mind, Emotions</td></tr>
            <tr><td style="color:#ef4444; font-weight:bold;">Mangal (Mars)</td><td>Younger Siblings, Courage, Property</td></tr>
            <tr><td style="color:#10b981; font-weight:bold;">Budh (Mercury)</td><td>Maternal Uncles, Intellect, Speech</td></tr>
            <tr><td style="color:#f59e0b; font-weight:bold;">Guru (Jupiter)</td><td>Children, Wealth, Guru, Husband (in female chart)</td></tr>
            <tr><td style="color:#fbcfe8; font-weight:bold;">Shukra (Venus)</td><td>Spouse/Wife (in male chart), Marriage, Vehicles</td></tr>
            <tr><td style="color:#e2e8f0; font-weight:bold;">Shani (Saturn)</td><td>Longevity, Sorrows, Elder Siblings, Subordinates</td></tr>
            <tr><td style="color:#94a3b8; font-weight:bold;">Rahu & Ketu</td><td>Paternal (Rahu) & Maternal (Ketu) Grandparents</td></tr>
        </table>

        <h4 style="color: var(--accent-gold); margin: 20px 0 10px 0; font-size: 14px; text-transform: uppercase;">Chara Karakas (Variable / Jaimini Scheme)</h4>
        <div style="margin-bottom: 10px; font-size: 12px; color: #94a3b8;">
            Based strictly on the degree of the planet within its respective sign (0° to 30°). The planet with the highest degree becomes the Atmakaraka (King of the Chart).
        </div>
        <table class="bphs-table matrix-table" style="font-size:12px;">
            <tr><th>Rank (by Degree)</th><th>Title</th><th>Symbol</th><th>Signification</th></tr>
            <tr><th style="color:#f1c40f;">1st (Highest °)</th><td><strong>Atmakaraka</strong></td><td>AK</td><td>The Soul, Core Self, Life Purpose (The King)</td></tr>
            <tr><th style="color:#60a5fa;">2nd</th><td><strong>Amatyakaraka</strong></td><td>AmK</td><td>Career, Mind, Minister, Advisors to the Soul</td></tr>
            <tr><th style="color:#34d399;">3rd</th><td><strong>Bhratrikaraka</strong></td><td>BK</td><td>Siblings, Guru, Spiritual Guide</td></tr>
            <tr><th style="color:#fbcfe8;">4th</th><td><strong>Matrikaraka</strong></td><td>MK</td><td>Mother, Home, Comforts, Education</td></tr>
            <tr><th style="color:#ef4444;">5th</th><td><strong>Pitrikaraka</strong></td><td>PiK</td><td>Father, Ancestors, Superiors, Children, Intellect, Followers, Creativity</td></tr>
            <tr><th style="color:#e2e8f0;">6th</th><td><strong>Gnatikaraka</strong></td><td>GK</td><td>Obstacles, Enemies, Diseases, Rivals</td></tr>
            <tr><th style="color:#f472b6;">7th (Lowest °)</th><td><strong>Darakaraka</strong></td><td>DK</td><td>Spouse, Partnerships, Wealth Accumulation</td></tr>
        </table>`
    }
};