

@group(0) @binding(0) var heatSampler: sampler;
@group(0) @binding(1) var valueTexture: texture_2d<f32>;
@group(0) @binding(2) var depthSampler: sampler;
@group(0) @binding(3) var depthTexture: texture_depth_2d;
struct Uniforms {
resolution: vec2<f32>,
mipLevel: f32,
};
@group(1) @binding(0) var<uniform> uniforms: Uniforms; 

struct Traversal {
	depth: f32,
	boundBox: vec4<f32>,
	coord: vec4<f32>,
	address: f32,
};

fn getTraversal(address: u32) -> Traversal {
	var trav: Traversal;
	let index = address*10;
	trav.depth = traversal[index]; 
	trav.boundBox = vec4<f32>(traversal[index + 1], traversal[index + 2], traversal[index + 3], traversal[index + 4]);
	trav.coord = vec4<f32>(traversal[index + 5], traversal[index + 6], traversal[index + 7], traversal[index + 8]);
	trav.address = traversal[index + 9];
	return trav;
};

@group(2) @binding(0) var<storage, read> levelValues: array<f32>;
@group(2) @binding(1) var<storage, read> traversal: array<f32>;

@fragment
fn main(@builtin(position) fragCoord: vec4<f32>) -> @location(0) vec4f {
	let pos = (fragCoord+1.0)/2.0;
	return fragCoord;
	// TODO temporary	


	let mipLevel = uniforms.mipLevel;

	let uv = (fragCoord.xy / uniforms.resolution);

	let textureSize: vec2<u32> = textureDimensions(depthTexture, 0);
	let pixCoord = vec2<u32>(uv * vec2<f32>(textureSize));
	let depth = textureSample(depthTexture, depthSampler, uv);
	let nextDepth = fragCoord.z;

	let value_color = textureSample(valueTexture, heatSampler, uv);
	//return value_color;
	
	// chess board pattern
	let x = i32(floor(uv.x * 10));
	let y = i32(floor(uv.y * 10));
	let c = (x + y) % 2;

	let checker_color = vec4<f32>(uv.x, uv.y - f32(c), f32(c), 0.0);
	
	//return vec4<f32>(depth, 0, 0, 1.0);
	var smallestDepth = 1.0;
	if (depth < nextDepth) {
		smallestDepth = depth;
	}
	let value = levelValues[u32(mipLevel*(1.0 - depth))];
	let index = mipLevel * (1.0 - depth)/mipLevel;
	let nextValue = levelValues[u32(mipLevel*(1.0 - nextDepth))];
	let nIndex = mipLevel * (1.0 - nextDepth)/mipLevel; 
	
	var color = vec4<f32>(0.0, 0.0, 0.0, 1.0);
	if (smallestDepth >= 0.0) {
		if(depth < nextDepth){
			color = vec4<f32>(depth, value, 0, 1.0);
			//return vec4<f32>(depth, value, index, 1.0);
			//return vec4<f32>(0.0, value, 0, 1.0);
			//return vec4<f32>(0.0, value, index, 1.0);
		}else{
			color = vec4<f32>(nextDepth, nextValue, 0, 1.0);
		}
		//return vec4<f32>(0.0, nextValue, 0, 1.0);
		//return vec4<f32>(nextDepth, nextValue, nIndex, 1.0);
		//return vec4<f32>(0.0, nextValue, nIndex, 1.0);
		//return vec4<f32>(0.0, nextValue, 0, 1.0);
	}else{
		
		return checker_color;
	}

	if (value_color.r > 0.5) {
		return checker_color;
	}
	return color;
}
