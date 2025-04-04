

@group(0) @binding(0) var depthSampler: sampler;
@group(0) @binding(1) var depthTexture: texture_depth_2d;
struct Uniforms {
resolution: vec2<f32>,
mipLevel: f32,
};
@group(1) @binding(0) var<uniform> uniforms: Uniforms; 

struct FragInput {
	@location(0) position: vec4<f32>,
	@location(1) values: vec4<f32>
};
@fragment
fn main(input: FragInput) -> @location(0) vec4f {
	let fragCoord = input.position;
	let pos = (fragCoord+1.0)/2.0;

	//return fragCoord;
	// TODO temporary	


	let mipLevel = uniforms.mipLevel;

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
	
	//return vec4<f32>(depth, 0, 0, 1.0);
	var smallestDepth = fragCoord.z;
	if (depth < nextDepth) {
		smallestDepth = depth;
	}
	
	

	//let value = levelValues[u32(mipLevel*(1.0 - depth))];
	let value = input.values.x;
	let index = mipLevel * (1.0 - depth)/mipLevel;
	let nIndex = mipLevel * (1.0 - nextDepth)/mipLevel; 

		
	var color = vec4<f32>(0.0, 0.0, 1.0, 1.0);
	if (smallestDepth >= 0.0) {
		if(depth < nextDepth){
			color = vec4<f32>(depth, value, 0.0, 1.0);
		}else{
			color = vec4<f32>(nextDepth, value, 0.0, 1.0);
		}
	}else{
		return checker_color;
	}

	//if (value_color.r > 0.5) {
	//	return checker_color;
	//}
	return color;
}
