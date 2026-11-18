package br.com.aguas.controller;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import br.com.aguas.dto.TelemetriaRequestDTO;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;

@RestController
@RequestMapping("/telemetria")
@Tag(name = "Telemetria")
public class TelemetriaController {

    /** O @Valid faz o Spring checar as anotações do DTO; se algo falhar, o método nem é chamado. */
    @PostMapping
    @ResponseStatus(HttpStatus.ACCEPTED)
    @Operation(summary = "Receber leitura de telemetria",
            description = "Usado pelo sensor. Vazão nula, negativa ou fora da faixa é recusada com 400.")
    @ApiResponse(responseCode = "202", description = "Leitura aceita.")
    @ApiResponse(responseCode = "400", description = "Dados inválidos; `campos` diz o problema de cada um.")
    public TelemetriaRequestDTO receber(@Valid @RequestBody TelemetriaRequestDTO leitura) {
        return leitura;
    }
}
