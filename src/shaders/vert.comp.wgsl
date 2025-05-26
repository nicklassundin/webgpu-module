struct Uniforms {
resolution: vec2<f32>,
_pad: vec2<f32>,
workgroupSize: vec2<u32>,
};


@group(0) @binding(0) var<storage, read_write> state: array<u32>;
// storage texture
@group(0) @binding(1) var outTexture: texture_storage_2d<rgba8unorm, write>;

@group(1) @binding(0) var<uniform> uniforms: Uniforms; 

// Sampler
@group(1) @binding(1) var mipSampler: sampler;
// texture
@group(1) @binding(2) var texture: texture_2d<f32>;

fn searchMipMapTexture(coord: vec2<u32>) -> vec4<f32> {
	let fullTextDim = textureDimensions(outTexture);
	let res = max(fullTextDim.x, fullTextDim.y);
	let uv = vec2<f32>(vec2<f32>(coord) / vec2<f32>(f32(res), f32(res)));
	for (var i: i32 = 0; i < 16; i = i + 1) {
		let textureValue = textureSampleLevel(texture, mipSampler, uv, f32(i));

		if (textureValue.w != 0.0) {
			// TODO change back to textureValue
			//return vec4<f32>(f32(i)/16.0, 0.0, 0.0, 1.0);
			return textureValue;
		}
	}
	return vec4<f32>(0.0, 0.0, 0.0, 0.0);
}

// Local variable
var<workgroup> id: u32;


const W_S: u32 = 16;
@compute @workgroup_size(16,16)
fn main(@builtin(local_invocation_id) local_id: vec3<u32>,
@builtin(workgroup_id) workgroup_id: vec3<u32>) {
	let index = workgroup_id.x + workgroup_id.y * (uniforms.workgroupSize.x);
	let workgroupSize = uniforms.workgroupSize.x;
	id = state[index];
	
	let u_d: vec2<u32> = workgroup_id.xy;
	let u_l: vec2<u32> = local_id.xy;

	let ud_size = workgroupSize;
	let ul_size = W_S;
	
	let texDim = max(textureDimensions(outTexture).x, textureDimensions(outTexture).y); 
	// get resolution even divided by ud_size*ud_size
	let res = (texDim / (ul_size * ud_size)) * (ul_size * ud_size) + ud_size;
	let g_t = vec2<u32>(res / (ul_size), res / ul_size);
	let i = id; 

	let g_c = vec2<u32>((i* ud_size) % g_t.x, ((i* ud_size) / g_t.y)*ud_size);
	let coord = g_c * ul_size + u_l + u_d * ul_size;
	


	//let color = searchMipMapTexture(coord);
	var color = searchMipMapTexture(coord);
	if (local_id.x == 0u || local_id.y == 0u) {
		color = vec4<f32>(0.0, 0.0, 1.0, 0.5);
		// if workgroup_id.x == 0u || workgroup_id.y == 0u color red
		if (workgroup_id.x == 0u && local_id.x == 0u) {
			color.y = 1.0;
		}
		if (workgroup_id.y == 0u && local_id.y == 0u) {
			color.x = 1.0;
		}
	}
	//let color = vec4<f32>(uniforms.resolution.x / f32(texDim), uniforms.resolution.y / 1536, 0.0, 1.0);
	textureStore(outTexture, vec2<i32>(coord), color);
	//textureStore(outTexture, vec2<i32>(coord), vec4<f32>(f32(local_id.x + workgroup_id.x) / (16), f32(local_id.y + workgroup_id.y) / (16), color.x, 1.0));
	//textureStore(outTexture, vec2<i32>(coord), vec4<f32>(f32(local_id.x + workgroup_id.x) / (16), f32(local_id.y + workgroup_id.y) / (16), color.x, 1.0));
	
	workgroupBarrier();
	if (local_id.x == 0u && local_id.y == 0u) {
		state[index] = id + 1u;
		if (f32(state[index]) > pow(f32(texDim / (ul_size * ud_size)),2)) {
			state[index] = 0u;
		}

	}
}
