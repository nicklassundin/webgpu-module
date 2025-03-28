

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
	

	let uv = (fragCoord.xy / uniforms.resolution);

	let textureSize: vec2<u32> = textureDimensions(depthTexture, 0);
	let pixCoord = vec2<u32>(uv * vec2<f32>(textureSize));
	let depth = textureSample(depthTexture, depthSampler, uv);
	let nextDepth = fragCoord.z;

	
	// chess board pattern
	let x = i32(floor(uv.x * 10));
	let y = i32(floor(uv.y * 10));
	let c = (x + y) % 2;

	let checker_color = vec4<f32>(uv.x, uv.y - f32(c), f32(c), 0.0);
	
	if (nextDepth >= 0.0) {
		if(depth < nextDepth){
			return vec4<f32>(depth, 0, 0, 1.0);
		}
		return vec4<f32>(nextDepth, 0, 0, 1.0);
	}else{
		
		return checker_color;
	}
}
