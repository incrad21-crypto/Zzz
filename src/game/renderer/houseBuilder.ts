import { getRobotState } from '../rules';
import { GameState, PartId, PropDef } from '../types';
import { getHouseFloorY, HOUSE_FLOOR_Y, HOUSE_ROOMS } from '../world';
import { safeNum } from './utils';

export function buildStaticHouseLayer(ctx: CanvasRenderingContext2D): void {
  // Slate shingle roof + eaves molding
  ctx.fillStyle = '#151c26';
  ctx.beginPath();
  ctx.moveTo(8, 122);
  ctx.lineTo(148, 10);
  ctx.lineTo(1002, 10);
  ctx.lineTo(1140, 122);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#1e2734';
  for (let ry = 18; ry < 116; ry += 8) {
    const inset = Math.round(((122 - ry) / 112) * 138);
    ctx.fillRect(14 + inset, ry, 1120 - inset * 2, 1);
    for (let sx = 20 + inset + (ry % 16 === 0 ? 6 : 0); sx < 1124 - inset; sx += 14) {
      ctx.fillRect(sx, ry + 1, 1, 6);
    }
  }
  // Roof dormer louver & stone chimney with mortar joints
  ctx.fillStyle = '#232c38';
  ctx.fillRect(670, -4, 150, 18);
  ctx.fillStyle = '#141a22';
  ctx.fillRect(676, 1, 138, 8);
  ctx.fillStyle = '#2f3845';
  for (let lx = 682; lx < 810; lx += 8) {
    ctx.fillRect(lx, 2, 4, 6);
  }
  ctx.fillStyle = '#2b303a';
  ctx.fillRect(324, -14, 30, 42);
  ctx.fillStyle = '#38404d';
  ctx.fillRect(322, -16, 34, 4);
  ctx.fillStyle = '#191d24';
  for (let by = -10; by < 22; by += 6) {
    ctx.fillRect(326, by, 26, 1);
    const stag = by % 12 === 0 ? 7 : 0;
    ctx.fillRect(331 + stag, by, 1, 5);
  }

  // Outer structural shell, rain gutter downspouts & stone basement plinth
  ctx.fillStyle = '#10151c';
  ctx.fillRect(14, 112, 1120, 464);
  // Exterior downspouts along left & right walls
  ctx.fillStyle = '#232c38';
  ctx.fillRect(11, 116, 4, 452);
  ctx.fillRect(1133, 116, 4, 452);
  ctx.fillStyle = '#364354';
  for (let cy = 140; cy < 540; cy += 72) {
    ctx.fillRect(10, cy, 6, 2);
    ctx.fillRect(1132, cy, 6, 2);
  }
  // Foundation stone blocks + damp moss streaks
  ctx.fillStyle = '#20262f';
  ctx.fillRect(10, 568, 1128, 18);
  ctx.fillStyle = '#151a21';
  for (let sx = 14; sx < 1130; sx += 16) {
    ctx.fillRect(sx, 570, 14, 6);
    ctx.fillRect(sx + 6, 578, 12, 5);
  }
  ctx.fillStyle = '#1b2b23';
  for (let mx = 28; mx < 1110; mx += 94) {
    ctx.fillRect(mx, 568, 12, 4);
    ctx.fillRect(mx + 3, 572, 6, 3);
  }

  for (const room of HOUSE_ROOMS) {
    const floorY = getHouseFloorY(room.floor);
    const topY = floorY - 96;

    ctx.fillStyle = room.wallColor;
    ctx.fillRect(room.x, topY, room.width, 96);

    if (room.floor === 4) {
      // Exposed attic rafters, collar beams & diagonal struts
      ctx.fillStyle = '#252d39';
      for (let rx = room.x + 20; rx < room.x + room.width - 10; rx += 46) {
        ctx.fillRect(rx, topY + 4, 5, 92);
        ctx.fillStyle = '#323d4d';
        ctx.fillRect(rx, topY + 4, 1, 92);
        ctx.fillStyle = '#252d39';
        ctx.fillRect(rx + 5, topY + 12, 5, 4);
        ctx.fillRect(rx - 5, topY + 12, 5, 4);
        ctx.fillRect(rx + 4, topY + 16, 2, 3);
        ctx.fillRect(rx - 3, topY + 16, 2, 3);
      }
      ctx.fillStyle = '#1e2530';
      ctx.fillRect(room.x, topY + 12, room.width, 4);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
      ctx.fillRect(room.x, topY + 12, room.width, 1);
      if (room.id === 'attic_west') {
        ctx.fillStyle = '#0e131b';
        for (let row = 0; row < 56; row += 4) {
          ctx.fillRect(room.x, topY + row, Math.max(0, 66 - row), 4);
        }
      } else if (room.id === 'attic_east') {
        ctx.fillStyle = '#0e131b';
        for (let row = 0; row < 56; row += 4) {
          const cutW = Math.max(0, 66 - row);
          ctx.fillRect(room.x + room.width - cutW, topY + row, cutW, 4);
        }
      }
    } else if (room.floorMaterial === 'tile') {
      // Ceramic tile backsplash & staggered grout
      for (let tx = room.x + 6; tx < room.x + room.width - 8; tx += 8) {
        for (let ty = floorY - 52; ty < floorY - 6; ty += 8) {
          ctx.fillStyle = ((tx + ty) / 8) % 2 === 0 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.11)';
          ctx.fillRect(tx, ty, 7, 7);
        }
      }
      if (room.id === 'f1_kitchen') {
        // Upper cupboards + brass pulls + spice shelf + hanging utensils
        ctx.fillStyle = '#2d3530';
        ctx.fillRect(room.x + 11, topY + 13, 48, 22);
        ctx.fillStyle = '#38423c';
        ctx.fillRect(room.x + 12, topY + 14, 46, 20);
        ctx.fillStyle = '#212723';
        ctx.fillRect(room.x + 34, topY + 16, 2, 16);
        ctx.fillStyle = '#8b9990';
        ctx.fillRect(room.x + 31, topY + 24, 2, 3);
        ctx.fillRect(room.x + 37, topY + 24, 2, 3);
        ctx.fillStyle = '#47392c';
        ctx.fillRect(room.x + 122, topY + 26, 32, 3);
        ctx.fillStyle = '#7b8a94';
        ctx.fillRect(room.x + 126, topY + 19, 4, 7);
        ctx.fillStyle = '#995c48';
        ctx.fillRect(room.x + 133, topY + 21, 4, 5);
        ctx.fillStyle = '#6a826e';
        ctx.fillRect(room.x + 141, topY + 20, 4, 6);
        ctx.fillStyle = '#6e7c85';
        ctx.fillRect(room.x + 128, topY + 29, 1, 7);
        ctx.fillRect(room.x + 138, topY + 29, 1, 9);
        ctx.fillRect(room.x + 137, topY + 37, 3, 2);
      }
    } else if (room.floorMaterial === 'concrete') {
      // Basement blockwork, mortar & overhead plumbing/electrical conduit
      ctx.fillStyle = 'rgba(0,0,0,0.24)';
      for (let by = topY + 14; by < floorY - 8; by += 14) {
        ctx.fillRect(room.x + 4, by, room.width - 8, 1);
        const stagger = by % 28 === 0 ? 10 : 0;
        for (let bx = room.x + 12 + stagger; bx < room.x + room.width - 10; bx += 22) {
          ctx.fillRect(bx, by, 1, 14);
        }
      }
      if (room.floor === 0) {
        ctx.fillStyle = '#2d3740';
        ctx.fillRect(room.x + 2, topY + 8, room.width - 4, 3);
        ctx.fillStyle = '#4b372c';
        ctx.fillRect(room.x + 2, topY + 12, room.width - 4, 2);
        ctx.fillStyle = '#5c6975';
        for (let px = room.x + 16; px < room.x + room.width - 12; px += 34) {
          ctx.fillRect(px, topY + 7, 2, 5);
          ctx.fillStyle = '#738291';
          ctx.fillRect(px, topY + 11, 2, 4);
          ctx.fillStyle = '#5c6975';
        }
        // Subtle damp seepage streaks down concrete walls
        ctx.fillStyle = 'rgba(12, 22, 26, 0.28)';
        for (let wx = room.x + 22; wx < room.x + room.width - 20; wx += 48) {
          ctx.fillRect(wx, topY + 15, 3, 18 + (wx % 12));
          ctx.fillRect(wx + 1, topY + 33, 1, 10);
        }
      }
    } else {
      // Aged vertical striped wallpaper + subtle stained border
      ctx.fillStyle = 'rgba(255,255,255,0.03)';
      for (let sx = room.x + 10; sx < room.x + room.width - 8; sx += 10) {
        ctx.fillRect(sx, topY + 6, 2, 68);
        if (sx % 20 === 0) {
          ctx.fillStyle = 'rgba(0,0,0,0.06)';
          ctx.fillRect(sx + 4, topY + 6, 1, 68);
          ctx.fillStyle = 'rgba(255,255,255,0.03)';
        }
      }
    }

    // Ceiling & corner ambient occlusion shadows
    ctx.fillStyle = 'rgba(0, 0, 0, 0.24)';
    ctx.fillRect(room.x + 3, topY + 5, room.width - 6, 6);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.16)';
    ctx.fillRect(room.x + 3, topY + 6, 4, 68);
    ctx.fillRect(room.x + room.width - 7, topY + 6, 4, 68);

    // Wainscoting paneling, chair rail & crown molding
    ctx.fillStyle = room.trimColor;
    ctx.fillRect(room.x, floorY - 22, room.width, 22);
    ctx.fillRect(room.x, topY, room.width, 5);
    ctx.fillStyle = 'rgba(255,255,255,0.09)';
    ctx.fillRect(room.x, floorY - 22, room.width, 1);
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    for (let px = room.x + 14; px < room.x + room.width - 10; px += 18) {
      ctx.fillRect(px, floorY - 19, 10, 14);
      ctx.fillStyle = 'rgba(255,255,255,0.04)';
      ctx.fillRect(px + 1, floorY - 18, 8, 1);
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
    }
    ctx.fillStyle = 'rgba(0,0,0,0.32)';
    ctx.fillRect(room.x, floorY - 2, room.width, 2);
    ctx.fillRect(room.x, topY + 5, room.width, 1);

    // Floorboards / tile / concrete slab + wood joinery
    ctx.fillStyle =
      room.floorMaterial === 'carpet'
        ? '#4a2926'
        : room.floorMaterial === 'tile'
        ? '#2e393d'
        : room.floorMaterial === 'concrete'
        ? '#252a30'
        : '#423326';
    ctx.fillRect(room.x, floorY, room.width, 8);
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.fillRect(room.x, floorY, room.width, 1);
    ctx.fillStyle = 'rgba(0,0,0,0.26)';
    for (let fx = room.x + 12; fx < room.x + room.width - 8; fx += 16) {
      ctx.fillRect(fx, floorY + 1, 1, 6);
      ctx.fillRect(fx + 5, floorY + 3, 7, 1);
    }
    ctx.fillStyle = '#0e1217';
    ctx.fillRect(room.x, floorY + 8, room.width, 8);

    // Patterned woven rugs with fringe in living/bedrooms/study
    if (room.id === 'f1_living' || room.id === 'f2_bedroom' || room.id === 'f2_cabinet') {
      const rugW = Math.min(116, room.width - 52);
      const rugX = room.x + Math.round((room.width - rugW) / 2);
      ctx.fillStyle = '#5c2c2b';
      ctx.fillRect(rugX, floorY, rugW, 3);
      ctx.fillStyle = '#8a5d42';
      ctx.fillRect(rugX + 4, floorY + 1, rugW - 8, 1);
      ctx.fillStyle = '#c4a97d';
      ctx.fillRect(rugX - 2, floorY + 1, 2, 1);
      ctx.fillRect(rugX + rugW, floorY + 1, 2, 1);
    }

    // Room wall divider beam
    ctx.fillStyle = '#0c1016';
    ctx.fillRect(room.x, topY, 3, 96);

    // Plaster crack & aging wear
    ctx.fillStyle = 'rgba(0, 0, 0, 0.24)';
    const crackX = room.x + 24 + ((room.x * 7) % Math.max(24, room.width - 48));
    ctx.fillRect(crackX, topY + 12, 1, 9);
    ctx.fillRect(crackX + 1, topY + 20, 1, 7);
    ctx.fillRect(crackX, topY + 26, 1, 5);
    if (room.floor <= 1) {
      ctx.fillStyle = 'rgba(10, 14, 18, 0.26)';
      ctx.fillRect(room.x + 4, floorY - 30, 14, 8);
      ctx.fillRect(room.x + room.width - 18, floorY - 28, 12, 6);
    }

    // Cobwebs tucked into attic & basement ceiling corners
    if (room.floor === 4 || room.floor === 0) {
      ctx.fillStyle = 'rgba(185, 200, 218, 0.16)';
      ctx.fillRect(room.x + 3, topY + 5, 11, 1);
      ctx.fillRect(room.x + 3, topY + 6, 8, 1);
      ctx.fillRect(room.x + 3, topY + 7, 5, 1);
      ctx.fillRect(room.x + 5, topY + 8, 2, 2);
      ctx.fillRect(room.x + room.width - 12, topY + 5, 10, 1);
      ctx.fillRect(room.x + room.width - 9, topY + 6, 7, 1);
      ctx.fillRect(room.x + room.width - 6, topY + 7, 4, 1);
    }
  }
}

export function drawStaircase(
  ctx: CanvasRenderingContext2D,
  x: number,
  bottomY: number,
  topY: number
): void {
  const steps = 12;
  const dx = 3;
  const dy = (bottomY - topY) / steps;
  for (let i = 0; i < steps; i++) {
    const sx = x - 18 + i * dx;
    const sy = bottomY - (i + 1) * dy;
    ctx.fillStyle = '#3b2f24';
    ctx.fillRect(Math.round(sx), Math.round(sy), 14, Math.ceil(dy) + 1);
    ctx.fillStyle = '#524234';
    ctx.fillRect(Math.round(sx), Math.round(sy), 14, 2);
  }
  ctx.strokeStyle = '#5a4939';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x - 16, bottomY - 19);
  ctx.lineTo(x + 18, topY - 19);
  ctx.stroke();
}

export function drawProp(
  ctx: CanvasRenderingContext2D,
  prop: PropDef,
  state: GameState,
  timeSec: number
): void {
  const y = getHouseFloorY(prop.floor);
  const x = prop.x;

  const heavyShadowWidths: Partial<Record<PropDef['type'], number>> = {
    sofa: 50,
    fridge: 26,
    cabinet: 28,
    archive_cabinets: 28,
    desk: 38,
    wardrobe: 32,
    grandfather_clock: 20,
    bathtub: 44,
    boxes: 32,
    workbench_tools: prop.floor === 3 ? 68 : 36,
    boiler: 34,
    radio_station: 30,
    monitors: 36,
    bed: 52,
    side_table: 18,
    storage_rack: 26,
    kitchen_counter: 26,
    pipe_valve: 16,
  };
  const shadowW = heavyShadowWidths[prop.type];
  if (shadowW) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.36)';
    ctx.fillRect(x - Math.round(shadowW / 2), y - 1, shadowW, 2);
  }

  switch (prop.type) {
    case 'exit_door': {
      ctx.fillStyle = '#2d2219';
      ctx.fillRect(x - 13, y - 56, 26, 56);
      ctx.fillStyle = '#473628';
      ctx.fillRect(x - 11, y - 54, 22, 54);
      ctx.fillStyle = '#182838';
      ctx.fillRect(x - 7, y - 51, 14, 7);
      ctx.fillStyle = 'rgba(155, 200, 238, 0.25)';
      ctx.fillRect(x - 6, y - 50, 12, 2);
      ctx.fillStyle = '#36291e';
      ctx.fillRect(x - 8, y - 40, 16, 16);
      ctx.fillRect(x - 8, y - 21, 16, 17);
      ctx.fillStyle = '#d4b45e';
      ctx.fillRect(x + 7, y - 27, 2, 4);
      ctx.fillStyle = 'rgba(135, 180, 220, 0.22)';
      ctx.fillRect(x - 10, y - 1, 20, 1);
      break;
    }
    case 'cellar_door': {
      const hasKey = state.collectedKeys.includes('basement_key');
      ctx.fillStyle = '#2a2018';
      ctx.fillRect(x - 13, y - 54, 26, 54);
      if (hasKey) {
        ctx.fillStyle = '#0c0f15';
        ctx.fillRect(x - 10, y - 51, 20, 51);
        ctx.fillStyle = '#2e241b';
        ctx.fillRect(x - 9, y - 10, 18, 3);
        ctx.fillRect(x - 9, y - 5, 18, 3);
        ctx.fillStyle = '#4f3d2e';
        ctx.fillRect(x - 11, y - 51, 5, 51);
      } else {
        ctx.fillStyle = '#463527';
        ctx.fillRect(x - 10, y - 51, 20, 51);
        ctx.fillStyle = '#222830';
        ctx.fillRect(x - 10, y - 41, 14, 2);
        ctx.fillRect(x - 10, y - 16, 14, 2);
        ctx.fillStyle = '#d4af54';
        ctx.fillRect(x + 5, y - 28, 4, 5);
        ctx.fillStyle = '#d95353';
        ctx.fillRect(x + 6, y - 32, 2, 2);
      }
      break;
    }
    case 'side_table':
      ctx.fillStyle = '#382a1e';
      ctx.fillRect(x - 8, y - 16, 3, 16);
      ctx.fillRect(x + 5, y - 16, 3, 16);
      ctx.fillStyle = '#4b392a';
      ctx.fillRect(x - 7, y - 7, 14, 2);
      ctx.fillStyle = '#5e4936';
      ctx.fillRect(x - 10, y - 18, 20, 3);
      ctx.fillStyle = '#755c46';
      ctx.fillRect(x - 9, y - 18, 18, 1);
      break;
    case 'kitchen_counter':
      ctx.fillStyle = '#3b4245';
      ctx.fillRect(x - 13, y - 20, 26, 20);
      ctx.fillStyle = '#292e30';
      ctx.fillRect(x - 11, y - 17, 22, 5);
      ctx.fillRect(x - 11, y - 10, 10, 8);
      ctx.fillRect(x + 1, y - 10, 10, 8);
      ctx.fillStyle = '#9aa6ad';
      ctx.fillRect(x - 2, y - 15, 4, 1);
      ctx.fillStyle = '#6c563f';
      ctx.fillRect(x - 14, y - 22, 28, 3);
      ctx.fillStyle = '#876d52';
      ctx.fillRect(x - 13, y - 22, 26, 1);
      break;
    case 'storage_rack':
      ctx.fillStyle = '#2b333b';
      ctx.fillRect(x - 13, y - 54, 2, 54);
      ctx.fillRect(x + 11, y - 54, 2, 54);
      ctx.fillStyle = '#404b57';
      for (const sy of [y - 50, y - 35, y - 20, y - 6]) {
        ctx.fillRect(x - 13, sy, 26, 2);
      }
      ctx.fillStyle = '#594838';
      ctx.fillRect(x - 10, y - 49, 10, 12);
      ctx.fillStyle = '#384b59';
      ctx.fillRect(x + 2, y - 47, 7, 10);
      ctx.fillStyle = '#4c3e30';
      ctx.fillRect(x - 9, y - 33, 17, 11);
      ctx.fillStyle = '#616e7a';
      ctx.fillRect(x - 6, y - 18, 8, 10);
      break;
    case 'floor_hatch':
      ctx.fillStyle = '#473628';
      ctx.fillRect(x - 16, y - 3, 32, 6);
      ctx.fillStyle = '#0e1319';
      ctx.fillRect(x - 12, y - 1, 24, 5);
      ctx.fillStyle = '#634c38';
      ctx.fillRect(x - 10, y + 1, 20, 2);
      ctx.fillStyle = '#b5944e';
      ctx.fillRect(x + 8, y - 2, 3, 2);
      break;
    case 'pipe_valve':
      ctx.fillStyle = '#53616e';
      ctx.fillRect(x - 14, y - 15, 10, 4);
      ctx.fillStyle = '#38434f';
      ctx.fillRect(x - 9, y - 22, 18, 22);
      ctx.fillStyle = '#5f7082';
      ctx.fillRect(x - 10, y - 22, 20, 3);
      ctx.fillStyle = '#b8944f';
      ctx.fillRect(x + 3, y - 18, 4, 4);
      ctx.fillStyle = '#181e24';
      ctx.fillRect(x + 4, y - 17, 2, 2);
      ctx.fillStyle = '#c24646';
      ctx.fillRect(x - 5, y - 15, 7, 7);
      ctx.fillStyle = '#252d36';
      ctx.fillRect(x - 4, y - 14, 5, 1);
      ctx.fillRect(x - 2, y - 16, 1, 5);
      ctx.fillStyle = '#14191f';
      ctx.fillRect(x - 2, y - 12, 2, 2);
      break;
    case 'coat_rack':
      ctx.fillStyle = '#47392d';
      ctx.fillRect(x - 1, y - 46, 3, 46);
      ctx.fillRect(x - 7, y - 2, 15, 2);
      ctx.fillStyle = '#332924';
      ctx.fillRect(x - 5, y - 50, 10, 2);
      ctx.fillRect(x - 3, y - 53, 6, 3);
      ctx.fillStyle = '#252f3d';
      ctx.fillRect(x - 6, y - 40, 12, 24);
      ctx.fillStyle = '#1b222e';
      ctx.fillRect(x - 2, y - 40, 2, 24);
      break;
    case 'mirror': {
      const isBathSecret = prop.floor === 2 && state.discoveredSecrets.includes('secret_bathroom_mirror');
      const shift = isBathSecret ? -14 : 0;
      if (prop.floor === 2 && isBathSecret) {
        ctx.fillStyle = '#0e141a';
        ctx.fillRect(x - 7, y - 48, 15, 26);
        ctx.fillStyle = '#2a3d47';
        ctx.fillRect(x - 6, y - 28, 13, 2);
        ctx.fillRect(x - 6, y - 38, 13, 1);
      }
      ctx.fillStyle = '#5c4b39';
      ctx.fillRect(x - 10 + shift, y - 50, 20, 30);
      ctx.fillStyle = '#314452';
      ctx.fillRect(x - 8 + shift, y - 48, 16, 26);
      ctx.fillStyle = 'rgba(205,235,255,0.22)';
      ctx.fillRect(x - 6 + shift, y - 46, 2, 18);
      ctx.fillRect(x - 3 + shift, y - 44, 1, 10);
      if (state.installedParts.length >= 4 && Math.sin(timeSec * 2.2) > 0.45) {
        ctx.fillStyle = 'rgba(12, 16, 22, 0.75)';
        ctx.fillRect(x + 1 + shift, y - 40, 5, 16);
        ctx.fillStyle = 'rgba(220, 82, 82, 0.7)';
        ctx.fillRect(x + 3 + shift, y - 37, 1, 1);
      }
      break;
    }
    case 'phone':
      ctx.fillStyle = '#473a2f';
      ctx.fillRect(x - 9, y - 22, 18, 22);
      ctx.fillStyle = '#322921';
      ctx.fillRect(x - 7, y - 19, 14, 15);
      ctx.fillStyle = '#181c22';
      ctx.fillRect(x - 6, y - 28, 12, 6);
      if (!state.phoneListened && Math.sin(timeSec * 5.2) > 0) {
        ctx.fillStyle = '#ff4b4b';
        ctx.fillRect(x + 2, y - 26, 2, 2);
      } else if (state.phoneListened) {
        ctx.fillStyle = '#5bd98b';
        ctx.fillRect(x + 2, y - 26, 2, 2);
      }
      break;
    case 'key_shelf':
      ctx.fillStyle = '#544333';
      ctx.fillRect(x - 10, y - 35, 20, 4);
      ctx.fillStyle = '#3b2e22';
      ctx.fillRect(x - 8, y - 31, 2, 4);
      ctx.fillRect(x + 6, y - 31, 2, 4);
      break;
    case 'sofa':
      ctx.fillStyle = '#472c2a';
      ctx.fillRect(x - 24, y - 16, 48, 16);
      ctx.fillStyle = '#5e3c39';
      ctx.fillRect(x - 22, y - 24, 44, 10);
      ctx.fillStyle = '#734d49';
      ctx.fillRect(x - 18, y - 17, 15, 6);
      ctx.fillRect(x + 2, y - 17, 15, 6);
      ctx.fillStyle = '#4d312f';
      ctx.fillRect(x - 25, y - 19, 5, 19);
      ctx.fillRect(x + 20, y - 19, 5, 19);
      break;
    case 'fireplace': {
      ctx.fillStyle = '#2a2d34';
      ctx.fillRect(x - 14, y - 92, 28, 50);
      ctx.fillStyle = '#1e2026';
      for (let by = y - 88; by < y - 46; by += 7) {
        ctx.fillRect(x - 13, by, 26, 1);
        const stag = by % 14 === 0 ? 7 : 0;
        ctx.fillRect(x - 7 + stag, by, 1, 6);
      }
      ctx.fillStyle = '#383a44';
      ctx.fillRect(x - 18, y - 44, 36, 44);
      ctx.fillStyle = '#4e505c';
      ctx.fillRect(x - 18, y - 44, 36, 2);
      ctx.fillStyle = '#5f606d';
      ctx.fillRect(x - 22, y - 46, 44, 4);
      // Candlestick + flickering wax flame
      ctx.fillStyle = '#8c7e65';
      ctx.fillRect(x - 17, y - 52, 3, 6);
      ctx.fillRect(x - 18, y - 47, 5, 1);
      ctx.fillStyle = Math.sin(timeSec * 9.5) > 0 ? '#f6d27a' : '#e08944';
      ctx.fillRect(x - 16, y - 55, 1, 3);
      // Framed mantle portrait
      ctx.fillStyle = '#4a3a2a';
      ctx.fillRect(x + 9, y - 54, 10, 8);
      ctx.fillStyle = '#c4b898';
      ctx.fillRect(x + 11, y - 52, 6, 5);
      ctx.fillStyle = '#3b332b';
      ctx.fillRect(x + 13, y - 51, 2, 3);
      // Hearth firebox + charred logs + cast-iron grate
      ctx.fillStyle = '#0d0e12';
      ctx.fillRect(x - 11, y - 24, 22, 24);
      ctx.fillStyle = '#34261f';
      ctx.fillRect(x - 8, y - 4, 16, 4);
      ctx.fillStyle = '#201916';
      ctx.fillRect(x - 10, y - 2, 20, 2);
      const fireActive = state.installedParts.length >= 1;
      const flickerA = Math.round(Math.sin(timeSec * 11) * 1.5);
      const flickerB = Math.round(Math.cos(timeSec * 15) * 1.5);
      const emberAlpha = fireActive
        ? 0.72 + Math.abs(Math.sin(timeSec * 5.1)) * 0.25
        : 0.3 + Math.abs(Math.sin(timeSec * 3.1)) * 0.25;
      ctx.fillStyle = `rgba(232, 82, 38, ${emberAlpha})`;
      ctx.fillRect(x - 7, y - 4, 14, 2);
      if (fireActive) {
        ctx.fillStyle = 'rgba(242, 118, 42, 0.9)';
        ctx.fillRect(x - 6 + flickerA, y - 11, 4, 7);
        ctx.fillRect(x + 2 + flickerB, y - 10, 4, 6);
        ctx.fillRect(x - 2 - flickerA, y - 15, 5, 11);
        ctx.fillStyle = 'rgba(255, 224, 130, 0.94)';
        ctx.fillRect(x - 2 + flickerB, y - 10, 3, 6);
        ctx.fillRect(x - 1 + flickerA, y - 13, 1, 3);
        const sparkY1 = Math.floor((timeSec * 22) % 16);
        const sparkY2 = Math.floor((timeSec * 17 + 7) % 15);
        ctx.fillStyle = 'rgba(255, 205, 105, 0.72)';
        ctx.fillRect(x + (sparkY1 % 5) - 2, y - 7 - sparkY1, 1, 1);
        ctx.fillRect(x - (sparkY2 % 4) + 1, y - 6 - sparkY2, 1, 1);
      }
      break;
    }
    case 'tv':
      ctx.fillStyle = '#3b3229';
      ctx.fillRect(x - 13, y - 31, 26, 31);
      ctx.fillStyle = '#4c4034';
      ctx.fillRect(x - 13, y - 31, 26, 2);
      ctx.fillStyle = '#241e18';
      ctx.fillRect(x - 10, y - 12, 20, 10);
      // Tuning dials & speaker grille
      ctx.fillStyle = '#7c8a96';
      ctx.fillRect(x + 6, y - 25, 3, 3);
      ctx.fillRect(x + 6, y - 20, 3, 3);
      ctx.fillStyle = '#687582';
      ctx.fillRect(x - 5, y - 37, 1, 6);
      ctx.fillRect(x + 4, y - 37, 1, 6);
      if (state.atmospheric.tvStaticTriggered) {
        ctx.fillStyle = '#253644';
        ctx.fillRect(x - 10, y - 28, 15, 14);
        const tvSeed = Math.floor(timeSec * 24);
        ctx.fillStyle = '#a4c4de';
        for (let sy = 0; sy < 13; sy += 2) {
          const sx = (tvSeed * 7 + sy * 13) % 9;
          ctx.fillRect(x - 9 + sx, y - 27 + sy, 5, 1);
        }
        ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
        ctx.fillRect(x - 10, y - 27 + (tvSeed % 12), 15, 1);
      } else {
        ctx.fillStyle = '#13191f';
        ctx.fillRect(x - 10, y - 28, 15, 14);
        ctx.fillStyle = 'rgba(130, 170, 205, 0.16)';
        ctx.fillRect(x - 9, y - 27, 2, 10);
      }
      ctx.fillStyle = state.atmospheric.tvStaticTriggered ? '#65e39d' : '#803535';
      ctx.fillRect(x + 7, y - 16, 2, 1);
      break;
    case 'bookshelf':
      ctx.fillStyle = '#423426';
      ctx.fillRect(x - 16, y - 54, 32, 54);
      ctx.fillStyle = '#544332';
      ctx.fillRect(x - 17, y - 55, 34, 2);
      ctx.fillStyle = '#261c13';
      ctx.fillRect(x - 14, y - 51, 28, 46);
      ctx.fillStyle = '#5c4a38';
      ctx.fillRect(x - 14, y - 38, 28, 2);
      ctx.fillRect(x - 14, y - 24, 28, 2);
      ctx.fillStyle = '#753e38';
      ctx.fillRect(x - 12, y - 49, 4, 11);
      ctx.fillStyle = '#426155';
      ctx.fillRect(x - 7, y - 48, 3, 10);
      ctx.fillStyle = '#5d6b82';
      ctx.fillRect(x - 3, y - 50, 4, 12);
      ctx.fillStyle = '#9c834f';
      ctx.fillRect(x + 3, y - 48, 3, 10);
      ctx.fillStyle = '#807052';
      ctx.fillRect(x - 10, y - 34, 5, 10);
      ctx.fillStyle = '#4d5d73';
      ctx.fillRect(x - 3, y - 33, 4, 9);
      ctx.fillStyle = '#704448';
      ctx.fillRect(x + 5, y - 35, 5, 11);
      // Small brass bookend/skull curio on bottom shelf
      ctx.fillStyle = '#96a1ab';
      ctx.fillRect(x - 9, y - 14, 5, 5);
      ctx.fillStyle = '#3c424a';
      ctx.fillRect(x + 2, y - 16, 8, 7);
      break;
    case 'photos':
      ctx.fillStyle = state.atmospheric.portraitChanged ? '#4a2020' : '#524436';
      ctx.fillRect(x - 11, y - 48, 22, 16);
      ctx.fillStyle = state.atmospheric.portraitChanged ? '#160909' : '#7a7263';
      ctx.fillRect(x - 9, y - 46, 18, 12);
      if (state.atmospheric.portraitChanged) {
        ctx.fillStyle = '#4a1b1b';
        ctx.fillRect(x - 5, y - 38, 10, 2);
        ctx.fillStyle = '#ff5252';
        ctx.fillRect(x - 2, y - 42, 2, 2);
        ctx.fillRect(x + 2, y - 42, 1, 2);
      } else {
        ctx.fillStyle = '#332b24';
        ctx.fillRect(x - 5, y - 43, 3, 8);
        ctx.fillRect(x + 2, y - 42, 3, 7);
        ctx.fillStyle = '#9e927c';
        ctx.fillRect(x - 4, y - 44, 2, 2);
        ctx.fillRect(x + 2, y - 43, 2, 2);
      }
      break;
    case 'fridge':
      ctx.fillStyle = '#6f7c82';
      ctx.fillRect(x - 12, y - 52, 24, 52);
      ctx.fillStyle = '#8a989e';
      ctx.fillRect(x - 11, y - 51, 22, 2);
      ctx.fillStyle = '#4f5a5f';
      ctx.fillRect(x - 12, y - 32, 24, 2);
      ctx.fillStyle = '#b4c2c7';
      ctx.fillRect(x + 7, y - 44, 2, 8);
      ctx.fillRect(x + 7, y - 25, 2, 10);
      break;
    case 'kitchen_table':
      ctx.fillStyle = '#3b2e22';
      ctx.fillRect(x - 24, y - 22, 3, 22);
      ctx.fillRect(x - 24, y - 12, 8, 2);
      ctx.fillRect(x + 21, y - 22, 3, 22);
      ctx.fillRect(x + 16, y - 12, 8, 2);
      ctx.fillStyle = '#594534';
      ctx.fillRect(x - 18, y - 19, 36, 3);
      ctx.fillRect(x - 14, y - 16, 3, 16);
      ctx.fillRect(x + 11, y - 16, 3, 16);
      ctx.fillStyle = '#738896';
      ctx.fillRect(x + 9, y - 23, 4, 4);
      break;
    case 'sink': {
      const wideBath = prop.floor === 2;
      const tapOffset = wideBath ? -4 : 0;
      ctx.fillStyle = '#485054';
      ctx.fillRect(x - (wideBath ? 14 : 12), y - 22, wideBath ? 28 : 24, 22);
      ctx.fillStyle = '#626d73';
      ctx.fillRect(x - (wideBath ? 14 : 12), y - 24, wideBath ? 28 : 24, 2);
      ctx.fillStyle = '#b4c2c7';
      ctx.fillRect(x - 9 + tapOffset, y - 24, 15, 1);
      ctx.fillStyle = '#8b9ca6';
      ctx.fillRect(x - 2 + tapOffset, y - 31, 4, 7);
      ctx.fillRect(x - 2 + tapOffset, y - 31, 6, 2);
      const drip = (timeSec * 14) % 9;
      if (drip < 6) {
        ctx.fillStyle = '#80c2eb';
        ctx.fillRect(x + 3 + tapOffset, y - 29 + Math.floor(drip), 1, 2);
      }
      break;
    }
    case 'cabinet':
    case 'archive_cabinets': {
      const isPowerLocker = prop.id === 'p_arch0';
      const isWorkshopDrawer = prop.id === 'p_cab3' && state.discoveredSecrets.includes('secret_workshop_drawer');
      const opened = (prop.containerId ? state.openedContainers.includes(prop.containerId) : false) || isWorkshopDrawer;
      ctx.fillStyle = isPowerLocker ? '#28323d' : '#39414a';
      ctx.fillRect(x - 13, y - 40, 26, 40);
      ctx.fillStyle = isPowerLocker ? '#435568' : '#4e5966';
      ctx.fillRect(x - 13, y - 40, 26, 2);
      if (isPowerLocker) {
        ctx.fillStyle = '#101922';
        ctx.fillRect(x - 10, y - 35, 20, 14);
        ctx.fillStyle = '#d49a4c';
        ctx.fillRect(x - 11, y - 37, 22, 1);
        ctx.fillStyle = '#252b32';
        ctx.fillRect(x - 11, y - 16, 22, 2);
        ctx.fillStyle = '#8a99a8';
        ctx.fillRect(x - 3, y - 10, 6, 2);
      } else {
        ctx.fillStyle = '#252b32';
        ctx.fillRect(x - 11, y - 27, 22, 2);
        ctx.fillRect(x - 11, y - 14, 22, 2);
        ctx.fillStyle = '#8a99a8';
        ctx.fillRect(x - 3, y - 34, 6, 2);
        ctx.fillRect(x - 3, y - 21, 6, 2);
        ctx.fillRect(x - 3, y - 8, 6, 2);
        if (opened) {
          ctx.fillStyle = '#12161c';
          ctx.fillRect(x - 10, y - 25, 20, 9);
          ctx.fillStyle = '#54606e';
          ctx.fillRect(x - 10, y - 19, 20, 4);
        }
      }
      break;
    }
    case 'safe': {
      ctx.fillStyle = '#2c343d';
      ctx.fillRect(x - 11, y - 34, 22, 22);
      ctx.fillStyle = '#404b57';
      ctx.fillRect(x - 9, y - 32, 18, 18);
      if (state.safeUnlocked) {
        ctx.fillStyle = '#0e1318';
        ctx.fillRect(x - 7, y - 30, 14, 14);
        ctx.fillStyle = '#566473';
        ctx.fillRect(x + 9, y - 32, 6, 18);
        ctx.fillStyle = '#5bd98b';
        ctx.fillRect(x - 7, y - 33, 3, 2);
      } else {
        ctx.fillStyle = '#192028';
        ctx.fillRect(x - 5, y - 28, 7, 7);
        ctx.fillStyle = '#d4aa4c';
        ctx.fillRect(x + 4, y - 25, 3, 3);
        ctx.fillStyle = '#d95757';
        ctx.fillRect(x - 7, y - 33, 3, 2);
      }
      break;
    }
    case 'painting': {
      const tilted = state.discoveredSecrets.includes('secret_painting') ? 6 : 0;
      ctx.fillStyle = '#11151b';
      ctx.fillRect(x - 9, y - 47, 18, 14);
      if (tilted !== 0) {
        ctx.fillStyle = '#314f66';
        ctx.fillRect(x - 6, y - 45, 12, 10);
        ctx.fillStyle = '#74b9e8';
        ctx.fillRect(x - 4, y - 42, 7, 1);
        ctx.fillRect(x - 4, y - 39, 5, 1);
      }
      ctx.fillStyle = '#5c4934';
      ctx.fillRect(x - 11 - tilted, y - 48, 22, 17);
      ctx.fillStyle = '#2e4038';
      ctx.fillRect(x - 9 - tilted, y - 46, 18, 13);
      ctx.fillStyle = '#5a7365';
      ctx.fillRect(x - 7 - tilted, y - 42, 12, 4);
      break;
    }
    case 'bed':
      ctx.fillStyle = '#4d3d2f';
      ctx.fillRect(x - 25, y - 16, 50, 16);
      ctx.fillRect(x - 25, y - 28, 4, 14);
      ctx.fillRect(x + 21, y - 22, 4, 8);
      ctx.fillStyle = '#586475';
      ctx.fillRect(x - 21, y - 20, 42, 8);
      ctx.fillStyle = '#424c59';
      ctx.fillRect(x - 6, y - 20, 27, 6);
      ctx.fillStyle = '#9aa4b0';
      ctx.fillRect(x - 21, y - 23, 11, 4);
      break;
    case 'desk':
      ctx.fillStyle = '#4c3b2c';
      ctx.fillRect(x - 20, y - 20, 40, 4);
      ctx.fillStyle = '#634d3a';
      ctx.fillRect(x - 20, y - 20, 40, 1);
      ctx.fillStyle = '#3b2e22';
      ctx.fillRect(x - 17, y - 16, 4, 16);
      ctx.fillRect(x + 13, y - 16, 4, 16);
      ctx.fillStyle = '#36291e';
      ctx.fillRect(x + 4, y - 16, 10, 11);
      ctx.fillStyle = '#b5944e';
      ctx.fillRect(x + 8, y - 12, 2, 1);
      // Warm banker lamp glow cone + papers & inkwell
      ctx.fillStyle = 'rgba(245, 208, 125, 0.16)';
      ctx.beginPath();
      ctx.moveTo(x + 7, y - 27);
      ctx.lineTo(x - 4, y - 20);
      ctx.lineTo(x + 19, y - 20);
      ctx.lineTo(x + 13, y - 27);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#687482';
      ctx.fillRect(x + 10, y - 28, 2, 8);
      ctx.fillStyle = '#8a744c';
      ctx.fillRect(x + 6, y - 31, 8, 4);
      ctx.fillStyle = '#f5d484';
      ctx.fillRect(x + 8, y - 27, 4, 1);
      ctx.fillStyle = '#dcd4bd';
      ctx.fillRect(x - 5, y - 21, 9, 1);
      ctx.fillRect(x - 3, y - 22, 6, 1);
      ctx.fillStyle = '#20262e';
      ctx.fillRect(x - 11, y - 23, 3, 3);
      break;
    case 'wardrobe': {
      const shifted = state.discoveredSecrets.includes('secret_wardrobe') ? -14 : 0;
      if (shifted !== 0) {
        ctx.fillStyle = '#0c1016';
        ctx.fillRect(x + 5, y - 52, 21, 52);
        ctx.fillStyle = '#2f2720';
        ctx.fillRect(x + 6, y - 20, 19, 2);
      }
      ctx.fillStyle = '#403226';
      ctx.fillRect(x - 15 + shifted, y - 56, 30, 56);
      ctx.fillStyle = '#544233';
      ctx.fillRect(x - 16 + shifted, y - 58, 32, 3);
      ctx.fillStyle = '#2c2117';
      ctx.fillRect(x - 1 + shifted, y - 54, 2, 52);
      ctx.fillStyle = '#33271c';
      ctx.fillRect(x - 12 + shifted, y - 50, 9, 20);
      ctx.fillRect(x + 3 + shifted, y - 50, 9, 20);
      ctx.fillStyle = '#a38952';
      ctx.fillRect(x - 3 + shifted, y - 32, 1, 3);
      ctx.fillRect(x + 2 + shifted, y - 32, 1, 3);
      break;
    }
    case 'grandfather_clock': {
      ctx.fillStyle = '#3d2f22';
      ctx.fillRect(x - 10, y - 62, 20, 62);
      ctx.fillStyle = '#594432';
      ctx.fillRect(x - 12, y - 64, 24, 3);
      ctx.fillRect(x - 6, y - 67, 12, 3);
      ctx.fillStyle = '#b5944e';
      ctx.fillRect(x - 1, y - 70, 2, 3);
      // Roman dial face + animated minute hand
      ctx.fillStyle = state.clockSolved ? '#d8ceb0' : '#a89f88';
      ctx.fillRect(x - 6, y - 56, 12, 10);
      ctx.fillStyle = '#1f1812';
      ctx.fillRect(x - 1, y - 52, 4, 1);
      ctx.fillRect(x - 1, y - 54, 1, 3);
      // Glass case with weight chains & swinging brass pendulum
      ctx.fillStyle = '#1b150f';
      ctx.fillRect(x - 5, y - 42, 10, 31);
      ctx.fillStyle = '#6e6042';
      ctx.fillRect(x - 3, y - 41, 1, 16);
      ctx.fillRect(x + 2, y - 41, 1, 12);
      const pendOffset = Math.round(Math.sin(timeSec * 2.4) * 2.4);
      ctx.fillStyle = '#c8a65c';
      ctx.fillRect(x + pendOffset, y - 40, 1, 19);
      ctx.fillRect(x - 2 + pendOffset, y - 21, 5, 4);
      ctx.fillStyle = '#f2da8d';
      ctx.fillRect(x - 1 + pendOffset, y - 20, 2, 2);
      ctx.fillStyle = 'rgba(180, 215, 240, 0.14)';
      ctx.fillRect(x - 4, y - 40, 1, 26);
      if (!state.clockSolved && Math.sin(timeSec * 3) > 0.2) {
        ctx.fillStyle = '#e0b858';
        ctx.fillRect(x + 6, y - 32, 2, 3);
      }
      break;
    }
    case 'bathtub':
      ctx.fillStyle = '#748085';
      ctx.fillRect(x - 21, y - 16, 42, 14);
      ctx.fillStyle = '#8b999e';
      ctx.fillRect(x - 22, y - 18, 44, 3);
      ctx.fillStyle = '#4b5459';
      ctx.fillRect(x - 18, y - 2, 4, 2);
      ctx.fillRect(x + 14, y - 2, 4, 2);
      ctx.fillRect(x - 18, y - 28, 2, 10);
      ctx.fillRect(x - 18, y - 28, 5, 2);
      break;
    case 'boxes': {
      const opened = prop.containerId ? state.openedContainers.includes(prop.containerId) : false;
      const isTrunk = prop.id === 'p_boxes4' || prop.id === 'p_boxes4b';
      if (isTrunk) {
        ctx.fillStyle = '#473628';
        ctx.fillRect(x - 16, y - 17, 32, 17);
        ctx.fillStyle = '#272c33';
        ctx.fillRect(x - 12, y - 17, 2, 17);
        ctx.fillRect(x + 10, y - 17, 2, 17);
        ctx.fillStyle = '#b5944e';
        ctx.fillRect(x - 2, y - 14, 4, 3);
        if (opened) {
          ctx.fillStyle = '#14171d';
          ctx.fillRect(x - 14, y - 17, 28, 4);
          ctx.fillStyle = '#5c4634';
          ctx.fillRect(x - 15, y - 22, 30, 4);
        } else {
          ctx.fillStyle = '#5c4634';
          ctx.fillRect(x - 16, y - 20, 32, 3);
        }
      } else {
        ctx.fillStyle = '#524233';
        ctx.fillRect(x - 15, y - 16, 16, 16);
        ctx.fillStyle = '#403427';
        ctx.fillRect(x + 2, y - 25, 14, 25);
        ctx.fillStyle = '#2c2219';
        ctx.fillRect(x + 4, y - 15, 10, 2);
        if (opened) {
          ctx.fillStyle = '#14171d';
          ctx.fillRect(x - 13, y - 15, 12, 4);
          ctx.fillStyle = '#6b5642';
          ctx.fillRect(x - 17, y - 20, 12, 3);
        } else {
          ctx.fillStyle = '#705a46';
          ctx.fillRect(x - 15, y - 17, 16, 2);
        }
      }
      break;
    }
    case 'workbench_tools': {
      const opened = prop.containerId ? state.openedContainers.includes(prop.containerId) : false;
      const isWideWorkshop = prop.floor === 3;
      if (isWideWorkshop) {
        ctx.fillStyle = '#47392b';
        ctx.fillRect(x - 34, y - 22, 68, 4);
        ctx.fillStyle = '#63503d';
        ctx.fillRect(x - 34, y - 22, 68, 1);
        ctx.fillStyle = '#332a21';
        ctx.fillRect(x - 31, y - 18, 4, 18);
        ctx.fillRect(x + 27, y - 18, 4, 18);
        ctx.fillStyle = '#283038';
        ctx.fillRect(x - 24, y - 18, 48, 8);
        ctx.fillStyle = '#7a8794';
        ctx.fillRect(x - 14, y - 15, 6, 2);
        ctx.fillRect(x + 8, y - 15, 6, 2);
        ctx.fillStyle = '#5e6b78';
        ctx.fillRect(x - 2, y - 26, 5, 4);
        ctx.fillStyle = '#38404a';
        ctx.fillRect(x - 18, y - 46, 36, 17);
        ctx.fillStyle = '#8896a6';
        ctx.fillRect(x - 12, y - 43, 2, 9);
        ctx.fillRect(x - 4, y - 44, 3, 11);
        ctx.fillRect(x + 5, y - 42, 2, 8);
        ctx.fillRect(x + 11, y - 43, 2, 9);
      } else {
        ctx.fillStyle = '#3d434a';
        ctx.fillRect(x - 17, y - 22, 34, 22);
        ctx.fillStyle = '#4c545e';
        ctx.fillRect(x - 14, y - 44, 28, 16);
        ctx.fillStyle = '#8896a6';
        ctx.fillRect(x - 10, y - 41, 2, 8);
        ctx.fillRect(x - 4, y - 42, 3, 10);
        ctx.fillRect(x + 4, y - 40, 2, 7);
        if (opened) {
          ctx.fillStyle = '#181c22';
          ctx.fillRect(x - 12, y - 16, 24, 5);
        }
      }
      break;
    }
    case 'monitors': {
      ctx.fillStyle = '#323942';
      ctx.fillRect(x - 17, y - 24, 34, 24);
      const on = state.terminalSolved || state.installedParts.length >= 3;
      ctx.fillStyle = state.terminalSolved ? '#123d2b' : on ? '#19453f' : '#162421';
      ctx.fillRect(x - 13, y - 39, 12, 12);
      ctx.fillRect(x + 2, y - 39, 12, 12);
      if (on) {
        const traceX = Math.floor(timeSec * 16) % 10;
        ctx.fillStyle = state.terminalSolved ? '#6ef0aa' : '#68f0d8';
        ctx.fillRect(x - 12, y - 33, 10, 1);
        ctx.fillRect(x - 12 + traceX, y - 36, 2, 5);
        ctx.fillRect(x + 3, y - 33, 10, 1);
        ctx.fillRect(x + 3 + ((traceX + 4) % 10), y - 35, 2, 4);
      } else if (Math.sin(timeSec * 4) > 0) {
        ctx.fillStyle = '#4cb888';
        ctx.fillRect(x - 11, y - 30, 3, 2);
      }
      break;
    }
    case 'hatch_frame': {
      const hatchOpen = state.collectedKeys.includes('attic_crowbar');
      ctx.fillStyle = '#4f3e2d';
      ctx.fillRect(x - 16, y - 95, 32, 6);
      if (hatchOpen) {
        ctx.fillStyle = '#090d12';
        ctx.fillRect(x - 12, y - 95, 24, 5);
        ctx.fillStyle = '#5c4734';
        ctx.fillRect(x - 15, y - 90, 6, 18);
        ctx.fillStyle = '#6b533c';
        ctx.fillRect(x - 6, y - 89, 2, 85);
        ctx.fillRect(x + 4, y - 89, 2, 85);
        for (let ry = y - 80; ry < y - 6; ry += 11) {
          ctx.fillRect(x - 4, ry, 8, 2);
        }
      }
      break;
    }
    case 'mannequin': {
      const mx = state.atmospheric.mannequinMoved ? x + 42 : x;
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(mx - 7, y - 2, 14, 2);
      ctx.fillStyle = '#42372c';
      ctx.fillRect(mx - 1, y - 16, 2, 16);
      ctx.fillRect(mx - 5, y - 2, 10, 2);
      ctx.fillStyle = '#7e6e5c';
      ctx.fillRect(mx - 6, y - 24, 12, 8);
      ctx.fillRect(mx - 4, y - 30, 8, 6);
      ctx.fillRect(mx - 6, y - 39, 12, 9);
      ctx.fillStyle = '#9e8d78';
      ctx.fillRect(mx - 5, y - 37, 4, 4);
      ctx.fillRect(mx + 1, y - 37, 4, 4);
      ctx.fillStyle = '#3c3127';
      ctx.fillRect(mx - 1, y - 40, 2, 24);
      ctx.fillRect(mx - 4, y - 33, 8, 1);
      ctx.fillStyle = '#4f4236';
      ctx.fillRect(mx - 2, y - 43, 4, 3);
      ctx.fillStyle = '#91816e';
      ctx.fillRect(mx - 3, y - 50, 6, 7);
      break;
    }
    case 'toys':
      ctx.fillStyle = '#78403e';
      ctx.fillRect(x - 8, y - 10, 6, 10);
      ctx.fillStyle = '#4d6582';
      ctx.fillRect(x + 2, y - 7, 7, 7);
      break;
    case 'radio_station':
      ctx.fillStyle = '#343c45';
      ctx.fillRect(x - 15, y - 28, 30, 28);
      ctx.fillStyle = '#21272e';
      ctx.fillRect(x - 12, y - 24, 24, 13);
      ctx.fillStyle = '#5e7687';
      ctx.fillRect(x - 11, y - 36, 22, 8);
      ctx.fillStyle = '#152028';
      ctx.fillRect(x - 8, y - 34, 16, 4);
      // Tuning scale & vacuum tube glow + telescoping antenna
      ctx.fillStyle = '#8b99a8';
      ctx.fillRect(x + 9, y - 57, 1, 21);
      ctx.fillRect(x + 8, y - 59, 3, 2);
      ctx.fillStyle = '#738291';
      ctx.fillRect(x - 9, y - 20, 3, 3);
      ctx.fillRect(x - 4, y - 20, 3, 3);
      if (state.installedParts.length >= 2) {
        const dialPos = Math.round((Math.sin(timeSec * 1.4) * 0.5 + 0.5) * 10);
        ctx.fillStyle = '#7cd4ff';
        ctx.fillRect(x - 7 + dialPos, y - 33, 2, 2);
        if (Math.sin(timeSec * 6) > 0) {
          ctx.fillStyle = '#e89d4d';
          ctx.fillRect(x + 4, y - 21, 2, 2);
        }
      }
      break;
    case 'boiler': {
      ctx.fillStyle = '#3c3533';
      ctx.fillRect(x - 17, y - 58, 34, 58);
      ctx.fillStyle = '#574e4b';
      ctx.fillRect(x - 15, y - 56, 30, 4);
      // Iron rivets along boiler seam
      ctx.fillStyle = '#756a66';
      for (let ry = y - 50; ry < y - 10; ry += 10) {
        ctx.fillRect(x - 15, ry, 1, 1);
        ctx.fillRect(x + 14, ry, 1, 1);
      }
      ctx.fillStyle = '#201c1b';
      ctx.fillRect(x - 10, y - 39, 20, 17);
      const glow = state.installedParts.length >= 2 ? '#f0633a' : '#a34836';
      ctx.fillStyle = glow;
      ctx.fillRect(x - 6, y - 34, 12, 7);
      ctx.fillStyle = '#ffbc6b';
      ctx.fillRect(x - 3 + (Math.sin(timeSec * 9) > 0 ? 1 : 0), y - 32, 6, 3);
      // Pressure dial & quivering needle
      ctx.fillStyle = '#8a99a8';
      ctx.fillRect(x + 4, y - 49, 7, 7);
      ctx.fillStyle = '#14181d';
      ctx.fillRect(x + 5, y - 48, 5, 5);
      ctx.fillStyle = '#ff6b52';
      ctx.fillRect(x + 7 + (Math.sin(timeSec * 18) > 0 ? 1 : 0), y - 47, 1, 3);
      // Exhaust stack & rising steam plumes
      ctx.fillStyle = '#2d2827';
      ctx.fillRect(x - 14, y - 64, 5, 6);
      ctx.fillStyle = 'rgba(185, 202, 218, 0.28)';
      const stOff = Math.floor(timeSec * 15) % 18;
      ctx.fillRect(x - 13, y - 66 - stOff, 4, 3);
      ctx.fillRect(x - 15, y - 73 - (stOff >> 1), 3, 2);
      break;
    }
    case 'pipes': {
      ctx.fillStyle = '#414c54';
      ctx.fillRect(x - 16, y - 78, 32, 4);
      ctx.fillRect(x - 4, y - 78, 4, 78);
      // Pipe flanges & rust collar
      ctx.fillStyle = '#5c6b75';
      ctx.fillRect(x - 5, y - 58, 6, 3);
      ctx.fillRect(x - 5, y - 28, 6, 3);
      ctx.fillStyle = '#734b38';
      ctx.fillRect(x - 4, y - 55, 4, 3);
      const dropPhase = (timeSec * 45) % 74;
      ctx.fillStyle = '#78b8e6';
      if (dropPhase < 70) {
        ctx.fillRect(x - 3, y - 74 + Math.floor(dropPhase), 2, 3);
      } else {
        ctx.fillStyle = 'rgba(130, 195, 238, 0.65)';
        ctx.fillRect(x - 7, y - 1, 10, 1);
        ctx.fillRect(x - 4, y - 2, 4, 1);
      }
      break;
    }
    case 'breaker_panel':
      ctx.fillStyle = '#353e48';
      ctx.fillRect(x - 10, y - 44, 20, 26);
      ctx.fillStyle = '#1b2026';
      ctx.fillRect(x - 7, y - 40, 14, 16);
      ctx.fillStyle = state.breakerFixed ? '#5bd98b' : '#d64545';
      ctx.fillRect(x - 2, y - 36, 4, 4);
      break;
    case 'vent_grate':
      ctx.fillStyle = '#293038';
      ctx.fillRect(x - 11, y - 24, 22, 18);
      ctx.fillStyle = '#0d1014';
      ctx.fillRect(x - 8, y - 21, 16, 3);
      ctx.fillRect(x - 8, y - 15, 16, 3);
      if (!state.breakerFixed && Math.sin(timeSec * 19) > 0.72) {
        ctx.fillStyle = '#7cd4ff';
        ctx.fillRect(x - 6, y - 19, 4, 1);
        ctx.fillRect(x + 2, y - 14, 3, 2);
      }
      break;
  }
}

export function drawPartSprite(
  ctx: CanvasRenderingContext2D,
  partId: PartId,
  x: number,
  y: number,
  timeSec: number
): void {
  const px = Math.round(safeNum(x, 0));
  const py = Math.round(safeNum(y, 0));
  const glint = Math.sin(timeSec * 4.4 + px) > 0.45;
  ctx.fillStyle = 'rgba(0, 0, 0, 0.48)';
  ctx.fillRect(px - 7, py - 1, 14, 2);

  switch (partId) {
    case 'left_arm':
    case 'right_arm':
      ctx.fillStyle = '#4a596a';
      ctx.fillRect(px - 8, py - 6, 3, 3);
      ctx.fillStyle = '#dfe7f0';
      ctx.fillRect(px - 6, py - 6, 5, 3);
      ctx.fillStyle = '#f8fbff';
      ctx.fillRect(px - 5, py - 6, 3, 1);
      ctx.fillStyle = '#536273';
      ctx.fillRect(px - 1, py - 6, 2, 3);
      ctx.fillStyle = '#d89b4e';
      ctx.fillRect(px - 1, py - 5, 1, 1);
      ctx.fillStyle = '#eff5fb';
      ctx.fillRect(px + 1, py - 6, 5, 2);
      ctx.fillStyle = '#bccad8';
      ctx.fillRect(px + 6, py - 6, 2, 3);
      ctx.fillRect(px + 8, py - 7, 2, 1);
      ctx.fillRect(px + 8, py - 5, 2, 1);
      ctx.fillRect(px + 8, py - 3, 1, 1);
      break;
    case 'left_leg':
    case 'right_leg':
      ctx.fillStyle = '#485563';
      ctx.fillRect(px - 7, py - 8, 2, 3);
      ctx.fillStyle = '#e5edf5';
      ctx.fillRect(px - 6, py - 9, 4, 4);
      ctx.fillStyle = '#536273';
      ctx.fillRect(px - 2, py - 7, 3, 3);
      ctx.fillStyle = glint ? '#7ce2ff' : '#4faed4';
      ctx.fillRect(px - 1, py - 6, 1, 1);
      ctx.fillStyle = '#cfdbe8';
      ctx.fillRect(px + 1, py - 6, 4, 4);
      ctx.fillStyle = '#eff5fb';
      ctx.fillRect(px + 4, py - 4, 3, 3);
      ctx.fillStyle = '#8b99a8';
      ctx.fillRect(px + 6, py - 2, 2, 1);
      break;
    case 'chest_panel':
      ctx.fillStyle = '#d4dee8';
      ctx.fillRect(px - 6, py - 9, 12, 4);
      ctx.fillStyle = '#eef4fa';
      ctx.fillRect(px - 5, py - 10, 10, 2);
      ctx.fillRect(px - 5, py - 5, 10, 2);
      ctx.fillRect(px - 4, py - 3, 8, 2);
      ctx.fillStyle = '#9aa9b8';
      ctx.fillRect(px - 5, py - 8, 4, 2);
      ctx.fillRect(px + 1, py - 8, 4, 2);
      ctx.fillStyle = '#14202b';
      ctx.fillRect(px - 2, py - 6, 4, 3);
      ctx.fillStyle = glint ? '#8be8ff' : '#50bce0';
      ctx.fillRect(px - 1, py - 5, 2, 2);
      break;
    case 'head':
      ctx.fillStyle = '#cfb87c';
      ctx.fillRect(px - 6, py - 9, 12, 8);
      ctx.fillStyle = '#e5d49a';
      ctx.fillRect(px - 5, py - 11, 10, 5);
      ctx.fillRect(px - 6, py - 6, 2, 5);
      ctx.fillRect(px + 4, py - 6, 2, 5);
      ctx.fillStyle = '#f5eac1';
      ctx.fillRect(px - 4, py - 11, 8, 2);
      ctx.fillStyle = '#9aa9b8';
      ctx.fillRect(px - 3, py - 7, 6, 5);
      ctx.fillStyle = '#141c24';
      ctx.fillRect(px - 2, py - 5, 2, 1);
      ctx.fillRect(px + 1, py - 5, 2, 1);
      break;
    case 'face_panel':
      ctx.fillStyle = '#dce5ef';
      ctx.fillRect(px - 4, py - 10, 8, 7);
      ctx.fillStyle = '#f4f7fb';
      ctx.fillRect(px - 3, py - 11, 6, 9);
      ctx.fillRect(px - 2, py - 2, 4, 1);
      ctx.fillStyle = '#1b222c';
      ctx.fillRect(px - 3, py - 7, 2, 1);
      ctx.fillRect(px + 1, py - 7, 2, 1);
      ctx.fillStyle = '#b0646c';
      ctx.fillRect(px - 1, py - 4, 2, 1);
      break;
    case 'power_core':
      ctx.fillStyle = '#4e5b69';
      ctx.fillRect(px - 5, py - 9, 10, 7);
      ctx.fillStyle = '#6f7e8f';
      ctx.fillRect(px - 4, py - 10, 8, 1);
      ctx.fillStyle = '#d99e4c';
      ctx.fillRect(px - 4, py - 11, 2, 2);
      ctx.fillRect(px + 2, py - 11, 2, 2);
      ctx.fillStyle = '#0e1822';
      ctx.fillRect(px - 3, py - 8, 6, 5);
      ctx.fillStyle = Math.sin(timeSec * 8) > 0 ? '#78e6ff' : '#40b5de';
      ctx.fillRect(px - 2, py - 7, 4, 3);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(px - 1, py - 6, 1, 1);
      break;
  }

  if (glint) {
    ctx.fillStyle = 'rgba(210, 242, 255, 0.72)';
    ctx.fillRect(px - 2, py - 13, 1, 1);
  }
}

export function drawRobotWorkbench(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  timeSec: number,
  reducedMotion = false
): void {
  const x = 1020;
  const y = HOUSE_FLOOR_Y[1];
  const installed = state.installedParts;
  const robotState = getRobotState(installed.length, state.finale.active, state.finale.phase);
  const isStanding =
    installed.length >= 8 &&
    (!state.finale.active || state.finale.phase !== 'rising' || state.finale.timer > 1.1);

  // Surgical gantry stanchions, articulated boom lamp & coiled ceiling umbilical
  ctx.fillStyle = '#252d36';
  ctx.fillRect(x - 32, y - 91, 2, 72);
  ctx.fillRect(x + 30, y - 91, 2, 72);
  ctx.fillStyle = '#394552';
  ctx.fillRect(x - 30, y - 90, 60, 2);
  ctx.fillStyle = '#323c47';
  ctx.fillRect(x - 1, y - 90, 2, 10);
  // Coiled power cables descending from gantry beam
  ctx.fillStyle = '#1d2d3d';
  ctx.fillRect(x - 18, y - 88, 1, 24);
  ctx.fillStyle = '#5c262b';
  ctx.fillRect(x + 17, y - 88, 1, 28);
  // Overhead surgical lamp hood + status diodes
  ctx.fillStyle = '#4c5a69';
  ctx.fillRect(x - 11, y - 81, 22, 4);
  ctx.fillStyle = '#68798a';
  ctx.fillRect(x - 8, y - 82, 16, 1);
  ctx.fillStyle = installed.length >= 5 ? '#ff6b6b' : installed.length >= 1 ? '#8fd8ff' : '#3d4854';
  ctx.fillRect(x - 8, y - 77, 16, 2);
  ctx.fillStyle = installed.length >= 6 ? '#ff3b3b' : '#5bd98b';
  ctx.fillRect(x - 10, y - 80, 1, 1);

  // Neural/EKG diagnostic oscillograph console mounted beside table
  ctx.fillStyle = '#2c343d';
  ctx.fillRect(x + 21, y - 64, 24, 19);
  ctx.fillStyle = '#434f5c';
  ctx.fillRect(x + 21, y - 64, 24, 1);
  ctx.fillStyle = '#0c151c';
  ctx.fillRect(x + 23, y - 61, 20, 13);
  const waveSpeed = installed.length >= 5 ? 24 : 14;
  const waveX = reducedMotion ? 6 : Math.floor(timeSec * waveSpeed) % 16;
  ctx.fillStyle = installed.length >= 5 ? '#ff5959' : '#58d4ff';
  ctx.fillRect(x + 24, y - 55, 17, 1);
  ctx.fillRect(x + 24 + waveX, y - 59, 2, 8);
  ctx.fillRect(x + 24 + ((waveX + 12) % 16), y - 56, 2, 4);
  // Console hardware LEDs
  ctx.fillStyle = installed.length >= 5 ? '#ff4f4f' : '#65e39d';
  ctx.fillRect(x + 24, y - 47, 2, 1);
  ctx.fillStyle = '#d4a65a';
  ctx.fillRect(x + 28, y - 47, 2, 1);

  // Hydraulic table base & trailing floor umbilical cables
  ctx.fillStyle = '#1b2229';
  ctx.fillRect(x - 13, y - 14, 3, 12);
  ctx.fillRect(x + 10, y - 14, 3, 12);
  ctx.fillRect(x - 15, y - 2, 30, 2);

  // Stainless steel surgical table top + beveled edge
  ctx.fillStyle = isStanding ? '#2a313a' : '#3b434d';
  ctx.fillRect(x - 37, y - 19, 74, 5);
  ctx.fillStyle = isStanding ? '#424d59' : '#647385';
  ctx.fillRect(x - 37, y - 19, 74, 1);
  ctx.fillStyle = isStanding ? '#1f252c' : '#282e36';
  ctx.fillRect(x - 33, y - 14, 5, 14);
  ctx.fillRect(x + 28, y - 14, 5, 14);
  ctx.fillStyle = '#25394d';
  ctx.fillRect(x - 16, y - 14, 2, 9);
  ctx.fillStyle = '#5c262b';
  ctx.fillRect(x - 4, y - 14, 1, 11);
  ctx.fillStyle = '#3a4a59';
  ctx.fillRect(x + 14, y - 14, 2, 8);

  // Surgical overhead light cone
  const coneAlpha = Math.min(0.18, 0.05 + installed.length * 0.016);
  ctx.fillStyle =
    installed.length >= 5
      ? `rgba(255, 85, 85, ${coneAlpha})`
      : `rgba(120, 200, 255, ${coneAlpha})`;
  ctx.beginPath();
  ctx.moveTo(x - 9, y - 75);
  ctx.lineTo(x - 40, y - 19);
  ctx.lineTo(x + 40, y - 19);
  ctx.lineTo(x + 9, y - 75);
  ctx.closePath();
  ctx.fill();

  const eyeColor =
    robotState === 'red_mode'
      ? '#ff2a2a'
      : robotState === 'almost' && Math.sin(timeSec * 8) > 0.78
      ? '#c75bff'
      : '#5cd4ff';

  if (!isStanding) {
    const rx = x - 14;
    const ry = y - 28;

    // Cradle clamps & padded neck headrest
    ctx.fillStyle = '#2b333d';
    ctx.fillRect(rx - 5, ry + 7, 38, 2);
    ctx.fillStyle = '#36404a';
    ctx.fillRect(rx + 21, ry + 2, 13, 7);

    // Pelvis assembly & hydraulic hip sockets
    ctx.fillStyle = '#738291';
    ctx.fillRect(rx - 3, ry + 1, 5, 8);
    ctx.fillStyle = '#dce5ef';
    ctx.fillRect(rx - 2, ry + 2, 3, 6);
    ctx.fillStyle = '#3a4552';
    ctx.fillRect(rx + 2, ry + 2, 3, 6);
    ctx.fillStyle = '#242d36';
    ctx.fillRect(rx - 4, ry + 2, 2, 2);
    ctx.fillRect(rx - 4, ry + 6, 2, 2);

    const chestRise = !reducedMotion && installed.length >= 4 && Math.sin(timeSec * 2.2) > 0.3 ? -1 : 0;
    if (!installed.includes('chest_panel')) {
      // Exposed titanium ribcage, coolant artery & internal servo spine
      ctx.fillStyle = '#3b4550';
      ctx.fillRect(rx + 5, ry + chestRise, 14, 9);
      ctx.fillStyle = '#171d24';
      ctx.fillRect(rx + 6, ry + 1 + chestRise, 12, 7);
      ctx.fillStyle = '#8b99a8';
      ctx.fillRect(rx + 7, ry + 1 + chestRise, 2, 7);
      ctx.fillRect(rx + 11, ry + 1 + chestRise, 2, 7);
      ctx.fillRect(rx + 15, ry + 1 + chestRise, 2, 7);
      ctx.fillStyle = installed.length >= 5 ? '#c4454d' : '#4085b0';
      ctx.fillRect(rx + 6, ry + 4 + chestRise, 12, 1);
      ctx.fillStyle = '#c89b52';
      ctx.fillRect(rx + 9, ry + 6 + chestRise, 6, 1);
    } else {
      // Sculpted porcelain breastplate & collar seam
      ctx.fillStyle = '#dce4ed';
      ctx.fillRect(rx + 5, ry + 1 + chestRise, 14, 7);
      ctx.fillStyle = '#f5f8fc';
      ctx.fillRect(rx + 10, ry - 1 + chestRise, 6, 3);
      ctx.fillRect(rx + 10, ry + 7 + chestRise, 6, 2);
      ctx.fillStyle = '#8b99a8';
      ctx.fillRect(rx + 16, ry + 2 + chestRise, 2, 5);
    }

    if (installed.includes('power_core')) {
      const isRed = installed.length >= 6;
      ctx.fillStyle = isRed ? 'rgba(255, 80, 80, 0.34)' : 'rgba(92, 212, 255, 0.3)';
      ctx.fillRect(rx + 8, ry + 1 + chestRise, 8, 7);
      ctx.fillStyle = isRed ? '#ff6464' : '#6be0ff';
      ctx.fillRect(rx + 10, ry + 3 + chestRise, 4, 3);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(rx + 11, ry + 4 + chestRise, 1, 1);
    }

    // Articulated synthetic legs with knee actuators & porcelain calves
    if (installed.includes('left_leg')) {
      ctx.fillStyle = '#d7e0ea';
      ctx.fillRect(rx - 12, ry, 9, 4);
      ctx.fillStyle = '#f3f7fb';
      ctx.fillRect(rx - 11, ry, 7, 1);
      ctx.fillStyle = '#758291';
      ctx.fillRect(rx - 14, ry + 1, 2, 3);
      ctx.fillStyle = '#c4ced9';
      ctx.fillRect(rx - 20, ry + 1, 6, 3);
      ctx.fillStyle = '#edf3fa';
      ctx.fillRect(rx - 22, ry - 1, 2, 4);
    }
    if (installed.includes('right_leg')) {
      ctx.fillStyle = '#aab6c4';
      ctx.fillRect(rx - 12, ry + 5, 9, 4);
      ctx.fillStyle = '#657180';
      ctx.fillRect(rx - 14, ry + 5, 2, 3);
      ctx.fillStyle = '#9aa6b4';
      ctx.fillRect(rx - 20, ry + 5, 6, 3);
      ctx.fillStyle = '#cfd9e3';
      ctx.fillRect(rx - 22, ry + 5, 2, 4);
    }

    // Arms & twitching porcelain hands
    const handTwitch = !reducedMotion && installed.length >= 3 && Math.sin(timeSec * 9.5) > 0.88 ? -1 : 0;
    if (installed.includes('left_arm')) {
      ctx.fillStyle = '#dde6f0';
      ctx.fillRect(rx + 5, ry - 3, 13, 2);
      ctx.fillStyle = '#f7fafe';
      ctx.fillRect(rx + 13, ry - 3, 4, 1);
      ctx.fillStyle = '#7b8a99';
      ctx.fillRect(rx + 11, ry - 3, 2, 2);
      ctx.fillStyle = '#eef4fa';
      ctx.fillRect(rx + 2, ry - 4 + handTwitch, 3, 2);
    }
    if (installed.includes('right_arm')) {
      ctx.fillStyle = '#aab6c4';
      ctx.fillRect(rx + 5, ry + 9, 13, 2);
      ctx.fillStyle = '#697585';
      ctx.fillRect(rx + 11, ry + 9, 2, 2);
      ctx.fillStyle = '#cfd9e3';
      ctx.fillRect(rx + 2, ry + 9 - handTwitch, 3, 2);
    }

    // Neck servo column & brass cable connector
    ctx.fillStyle = '#313c4a';
    ctx.fillRect(rx + 19, ry + 1, 4, 6);
    ctx.fillStyle = '#738291';
    ctx.fillRect(rx + 20, ry + 2, 2, 4);
    ctx.fillStyle = '#a83c3c';
    ctx.fillRect(rx + 20, ry + 4, 2, 1);

    const headTilt = !reducedMotion && installed.length >= 4 ? Math.round(Math.sin(timeSec * 2.4)) : 0;
    const twitch = !reducedMotion && installed.length >= 2 && Math.sin(timeSec * 11) > 0.94 ? 1 : 0;
    const hy = ry - 3 + headTilt - twitch;
    if (installed.includes('head')) {
      // Sculpted blonde hair strands + porcelain cranium + optional face plate
      ctx.fillStyle = '#cbb87d';
      ctx.fillRect(rx + 15, hy + 2, 8, 6);
      ctx.fillRect(rx + 22, hy, 10, 9);
      ctx.fillStyle = '#e5d49a';
      ctx.fillRect(rx + 23, hy - 1, 8, 3);
      ctx.fillRect(rx + 17, hy + 1, 6, 6);
      ctx.fillStyle = '#f5eac1';
      ctx.fillRect(rx + 25, hy - 1, 5, 2);
      ctx.fillStyle = installed.includes('face_panel') ? '#f4f7fa' : '#4a5562';
      ctx.fillRect(rx + 23, hy + 1, 6, 7);
      if (installed.includes('face_panel')) {
        ctx.fillStyle = '#b0646c';
        ctx.fillRect(rx + 24, hy + 6, 2, 1);
      }
    } else {
      ctx.fillStyle = '#738190';
      ctx.fillRect(rx + 22, hy + 1, 8, 7);
      ctx.fillStyle = '#38414d';
      ctx.fillRect(rx + 24, hy + 2, 5, 5);
    }

    // Electrical micro-sparks during mid assembly
    if (!reducedMotion && installed.length >= 1 && installed.length < 8 && Math.sin(timeSec * 23) > 0.85) {
      ctx.fillStyle = installed.length >= 5 ? '#ff7b7b' : '#7cd4ff';
      ctx.fillRect(rx + 15, ry - 4, 2, 2);
      ctx.fillRect(rx + 18, ry + 8, 2, 1);
    }

    // Gaze tracking toward protagonist in pantry
    const lookLeftShift =
      state.player.zone === 'house' && state.player.floor === 1 && state.player.x < 1015 ? -1 : 0;
    if (Math.sin(timeSec * 4) > -0.5) {
      ctx.fillStyle = robotState === 'red_mode' ? 'rgba(255, 50, 50, 0.36)' : 'rgba(92, 212, 255, 0.3)';
      ctx.fillRect(rx + 23, hy + 2, 4, 4);
      ctx.fillStyle = eyeColor;
      ctx.fillRect(rx + 24 + lookLeftShift, hy + 3, 2, 2);
    }
  } else {
    // Fully assembled Echo-4 standing beside the surgical workbench
    const rx = Math.round(x - state.finale.robotOffsetX);
    const fy = y + 2;
    const jitter = !reducedMotion && state.finale.active && Math.sin(timeSec * 36) > 0.82 ? 1 : 0;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.72)';
    ctx.fillRect(rx - 8, fy - 1, 16, 2);

    // Flowing hair silhouette behind shoulders
    ctx.fillStyle = '#bfa96c';
    ctx.fillRect(rx - 6 + jitter, fy - 39, 12, 11);
    ctx.fillRect(rx - 5 + jitter, fy - 28, 10, 4);

    // Sculpted porcelain legs, knee actuators & feet
    ctx.fillStyle = '#d3dce6';
    ctx.fillRect(rx - 4, fy - 20, 3, 9);
    ctx.fillRect(rx + 1, fy - 20, 3, 9);
    ctx.fillStyle = '#5c6978';
    ctx.fillRect(rx - 4, fy - 11, 3, 2);
    ctx.fillRect(rx + 1, fy - 11, 3, 2);
    ctx.fillStyle = '#bcc8d6';
    ctx.fillRect(rx - 3, fy - 9, 2, 7);
    ctx.fillRect(rx + 1, fy - 9, 2, 7);
    ctx.fillStyle = '#eef4fa';
    ctx.fillRect(rx - 4, fy - 2, 3, 2);
    ctx.fillRect(rx + 1, fy - 2, 3, 2);

    // Waist joint, porcelain torso & glowing power core
    ctx.fillStyle = '#cfd9e3';
    ctx.fillRect(rx - 5 + jitter, fy - 23, 10, 4);
    ctx.fillStyle = '#3a4654';
    ctx.fillRect(rx - 3 + jitter, fy - 26, 6, 3);
    ctx.fillStyle = '#ebf1f7';
    ctx.fillRect(rx - 5 + jitter, fy - 35, 10, 9);
    ctx.fillStyle = '#cfd9e3';
    ctx.fillRect(rx - 4 + jitter, fy - 36, 8, 1);
    ctx.fillStyle = '#9aa8b8';
    ctx.fillRect(rx - 5 + jitter, fy - 31, 3, 2);
    ctx.fillRect(rx + 2 + jitter, fy - 31, 3, 2);

    ctx.fillStyle = robotState === 'red_mode' ? 'rgba(255, 42, 42, 0.3)' : 'rgba(92, 212, 255, 0.28)';
    ctx.fillRect(rx - 3 + jitter, fy - 32, 6, 6);
    ctx.fillStyle = eyeColor;
    ctx.fillRect(rx - 1 + jitter, fy - 30, 2, 2);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(rx - 1 + jitter, fy - 30, 1, 1);

    ctx.fillStyle = '#5c6978';
    ctx.fillRect(rx - 1 + jitter, fy - 39, 2, 3);

    // Reaching arms during finale approach / resting side stance otherwise
    const armReach = state.finale.phase === 'approach' || state.finale.phase === 'fade' ? -9 : 0;
    ctx.fillStyle = '#d8e1eb';
    if (armReach !== 0) {
      ctx.fillRect(rx - 6 + armReach, fy - 34, 8, 2);
      ctx.fillRect(rx + 2 + armReach, fy - 34, 6, 2);
      ctx.fillStyle = '#eef4fa';
      ctx.fillRect(rx - 9 + armReach, fy - 35, 3, 3);
    } else {
      ctx.fillRect(rx - 7, fy - 34, 2, 13);
      ctx.fillRect(rx + 5, fy - 34, 2, 13);
      ctx.fillStyle = '#738291';
      ctx.fillRect(rx - 7, fy - 28, 2, 2);
      ctx.fillRect(rx + 5, fy - 28, 2, 2);
      ctx.fillStyle = '#eef4fa';
      ctx.fillRect(rx - 7, fy - 21, 2, 2);
      ctx.fillRect(rx + 5, fy - 21, 2, 2);
    }

    // Porcelain face, luminous eyes & sculpted hair frame
    ctx.fillStyle = '#e5d49a';
    ctx.fillRect(rx - 4 + jitter, fy - 48, 8, 2);
    ctx.fillRect(rx - 5 + jitter, fy - 46, 10, 6);
    ctx.fillRect(rx - 5 + jitter, fy - 40, 2, 9);
    ctx.fillRect(rx + 3 + jitter, fy - 40, 2, 9);
    ctx.fillStyle = '#f5eac1';
    ctx.fillRect(rx - 3 + jitter, fy - 47, 6, 2);
    ctx.fillStyle = '#f2f6fa';
    ctx.fillRect(rx - 3 + jitter, fy - 44, 6, 6);
    ctx.fillRect(rx - 2 + jitter, fy - 38, 4, 1);
    ctx.fillStyle = robotState === 'red_mode' ? 'rgba(255, 42, 42, 0.36)' : 'rgba(92, 212, 255, 0.32)';
    ctx.fillRect(rx - 3 + jitter, fy - 43, 6, 3);
    ctx.fillStyle = eyeColor;
    ctx.fillRect(rx - 2 + jitter, fy - 42, 2, 1);
    ctx.fillRect(rx + 1 + jitter, fy - 42, 2, 1);
    ctx.fillStyle = '#b0646c';
    ctx.fillRect(rx - 1 + jitter, fy - 39, 2, 1);

    if (!reducedMotion && state.finale.active && state.finale.phase === 'rising' && Math.sin(timeSec * 27) > 0.4) {
      ctx.fillStyle = '#ff4b4b';
      ctx.fillRect(rx - 8, fy - 29, 2, 2);
      ctx.fillRect(rx + 7, fy - 39, 2, 2);
    }
  }
}
