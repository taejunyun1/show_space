import {expect,it} from 'vitest';
import {DEFAULT_OUTDOOR,localInstants,outdoorInstant,parseOutdoor,solarPosition,outdoorAppearance,presetOutdoor} from './outdoor';
const s={...DEFAULT_OUTDOOR,mode:'outdoor' as const};
it('resolves project-local dates independently of host timezone, including DST gaps and overlaps',()=>{
 expect(new Date(outdoorInstant(s)).toISOString()).toBe('2026-06-21T03:00:00.000Z');
 const ny={...s,timeZone:'America/New_York',date:'2026-03-08',time:'02:30'};expect(localInstants(ny)).toEqual([]);expect(()=>parseOutdoor(ny)).toThrow('존재하지');
 const repeat={...ny,date:'2026-11-01',time:'01:30'};expect(localInstants(repeat).map(t=>new Date(t).toISOString())).toEqual(['2026-11-01T05:30:00.000Z','2026-11-01T06:30:00.000Z']);expect(outdoorInstant({...repeat,occurrence:'later'})-outdoorInstant(repeat)).toBe(3600000);
 const kathmandu={...s,timeZone:'Asia/Kathmandu',date:'2024-02-29',time:'00:00'};expect(new Date(outdoorInstant(kathmandu)).toISOString()).toBe('2024-02-28T18:15:00.000Z');
});
it('validates calendar, coordinates and zones and drops unknown private fields',()=>{
 for(const patch of [{latitude:91},{longitude:NaN},{time:'24:00'},{date:'2026-02-29'},{date:'2100-01-01'},{timeZone:'not/a/zone'},{sunIntensity:Infinity},{shadow:1}])expect(()=>parseOutdoor({...s,...patch})).toThrow();
 expect(parseOutdoor({...s,privateNote:'secret'})).toEqual(s);
});
it('matches published NREL SPA example to within one degree using the simpler NOAA approximation',()=>{
 // NREL/TP-560-34302 Table A5.1: 2003-10-17 12:30:30 MST,
 // latitude 39.742476, longitude -105.1786, zenith 50.111622°, azimuth 194.340241°.
 // Minute input, geometric altitude: intentionally not SPA precision/refraction.
 const position=solarPosition({...s,latitude:39.742476,longitude:-105.1786,timeZone:'Etc/GMT+7',date:'2003-10-17',time:'12:30'});
 expect(Math.abs(position.elevation-(90-50.111622))).toBeLessThan(1);expect(Math.abs(position.azimuth-194.340241)).toBeLessThan(1);
});
it('keeps solar position identical for the same instant and rotates plan north without changing altitude',()=>{
 const sun=solarPosition(s),utc=solarPosition({...s,timeZone:'UTC',time:'03:00'});expect(utc).toEqual(sun);
 const turned=solarPosition({...s,northDeg:90});expect(turned.elevation).toBe(sun.elevation);expect(turned.direction[0]).toBeCloseTo(-sun.direction[2]);expect(turned.direction[2]).toBeCloseTo(sun.direction[0]);
 for(const latitude of [-90,-37,0,90])for(const date of ['2024-02-29','2026-12-21']){const v=solarPosition({...s,latitude,date});expect(v.direction.every(Number.isFinite)).toBe(true);expect(Math.hypot(...v.direction)).toBeCloseTo(1);}
 expect(solarPosition({...s,time:'08:00'}).direction[0]).toBeGreaterThan(0);expect(solarPosition({...s,time:'17:00'}).direction[0]).toBeLessThan(0);
});
it('uses actual sunset/night times, switches daylight and handles polar dates without fabricating sunsets',()=>{
 const sunset=presetOutdoor(s,'sunset'),night=presetOutdoor(s,'night');expect(solarPosition(sunset).hourAngle).toBeGreaterThan(0);expect(solarPosition(sunset).elevation).toBeGreaterThan(0);expect(solarPosition(sunset).elevation).toBeLessThan(12);expect(outdoorAppearance(night)!.sunIntensity).toBe(0);expect(outdoorAppearance(s)!.sunIntensity).toBe(3);expect(outdoorAppearance({...s,preset:'cloudy'})!.sunIntensity).toBeLessThan(1);
 expect(()=>presetOutdoor({...s,latitude:90},'night')).toThrow('백야');expect(()=>presetOutdoor({...s,latitude:90},'sunset')).toThrow();expect(outdoorAppearance(DEFAULT_OUTDOOR)).toBeNull();
});
