
struct VertexOutput {
	@builtin(position) Position : vec4f,
}

@vertex
fn main(@location(0) position : vec4f) -> @builtin(position) vec4f {
	return position;
}
