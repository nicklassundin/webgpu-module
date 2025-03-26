
struct Uniforms {
resolution: vec2<f32>,
mipLevel: f32,
};

@group(0) @binding(0) var heatSampler: sampler;
@group(0) @binding(1) var valueTexture: texture_2d<f32>;
@group(0) @binding(2) var depthSampler: sampler;
@group(0) @binding(3) var depthTexture: texture_depth_2d;
@group(1) @binding(0) var<uniform> uniforms: Uniforms; 

@fragment
fn main(@builtin(position) fragCoord: vec4<f32>) -> @location(0) vec4f {

	let uv = (fragCoord.xy / uniforms.resolution);

	//let color = textureSampleLevel(depthTexture, heatSampler, uv, 0);
	let textureSize: vec2<u32> = textureDimensions(depthTexture, 0);
	let pixCoord = uv * vec2<f32>(textureSize);
	//return vec4<f32>(pixCoord / vec2<f32>(textureSize), 0.0, 1.0);
	//let depth = textureLoad(valueTexture, vec2<i32>(pixCoord), 0).x;
	let depth = textureSample(depthTexture, depthSampler, uv);
	let depth_int = 11 - depth*11;
	
	let color = vec4<f32>(depth, depth, depth, 1.0);
	//let color = textureSampleLevel(valueTexture, heatSampler, uv, depth_int);
	//let color = textureLoad(valueTexture, uv, u32(depth*11));
	// chess board pattern
	let x = i32(floor(uv.x * 10));
	let y = i32(floor(uv.y * 10));
	let c = (x + y) % 2;

	let checker_color = vec4<f32>(uv.x, uv.y - f32(c), f32(c), 1.0 -(color.r + color.g) / 2.0);

	if (color.r + color.g + color.b > 0.0) {
	 	return vec4<f32>(color.r, color.g, color.b, 1.0);
		//return vec4<f32>(uv, 0.0, 1.0);
	}else{
		return checker_color;
	}
}
